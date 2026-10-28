import { z } from "zod";
import { fenced, type ToolSpec } from "@/lib/llm/client";
import type { ToolBox, ToolOutcome } from "@/lib/llm/tool-loop";
import { memoizePromise } from "@/lib/memoize-promise";
import type { Reference, SymbolIndex } from "@/lib/symbols/symbol-index";
import type { SymbolDefinition } from "@/lib/types";

export type CodeLookupIndex = Pick<
  SymbolIndex,
  "listFiles" | "definitionsOf" | "referencesTo" | "search" | "readLines"
>;

const RESULT_TAG = "pr_tool_result";
const MAX_RESULT_CHARS = 6_000;
const MAX_LOOKUP_RESULTS = 40;
const MAX_DEFINITIONS = 3;
const MAX_DEFINITION_LINES = 60;
const MAX_READ_LINES = 150;
const MAX_LOOKUP_PATHS = 20;
const TRUNCATED_NOTE = "\n… (truncated)";
const RESULT_CLOSE = `\n</${RESULT_TAG}>`;

const NameInput = z.object({ name: z.string().trim().min(1).max(200) });

const QueryInput = z.object({ query: z.string().trim().min(2).max(200) });

const ReadInput = z
  .object({
    path: z.string().trim().min(1).max(500),
    start_line: z.number().int().positive(),
    end_line: z.number().int().positive(),
  })
  .refine((input) => input.end_line >= input.start_line, "end_line is before start_line");

const NAME_SCHEMA = {
  type: "object",
  properties: { name: { type: "string", description: "The identifier, exactly as written." } },
  required: ["name"],
};

const SPECS: ToolSpec[] = [
  {
    name: "find_definition",
    description:
      "Show where a function, method, type or variable is defined in the PR's head checkout, with its body.",
    input_schema: NAME_SCHEMA,
  },
  {
    name: "find_references",
    description:
      "List lines in the PR's head checkout that use a name (callers, imports, overrides). Use it to see who depends on changed code.",
    input_schema: NAME_SCHEMA,
  },
  {
    name: "search_code",
    description:
      "Search the text of the PR's head checkout for a fixed string, ignoring case. Use it to see whether a pattern appears elsewhere.",
    input_schema: {
      type: "object",
      properties: { query: { type: "string", description: "At least 2 characters." } },
      required: ["query"],
    },
  },
  {
    name: "read_file",
    description:
      "Read numbered lines of a tracked file in the PR's head checkout. At most 150 lines per call.",
    input_schema: {
      type: "object",
      properties: {
        path: { type: "string", description: "Repository-relative path." },
        start_line: { type: "integer", minimum: 1 },
        end_line: { type: "integer", minimum: 1 },
      },
      required: ["path", "start_line", "end_line"],
    },
  },
];

function memoized<T>(load: () => Promise<T>): () => Promise<T> {
  const cache = new Map<"value", Promise<T>>();
  return () => memoizePromise(cache, "value", load);
}

function fencedResult(body: string): string {
  const wrapped = fenced(RESULT_TAG, body);
  if (wrapped.length <= MAX_RESULT_CHARS) return wrapped;
  const keep = MAX_RESULT_CHARS - TRUNCATED_NOTE.length - RESULT_CLOSE.length;
  return `${wrapped.slice(0, keep)}${TRUNCATED_NOTE}${RESULT_CLOSE}`;
}

function outcome(tool: string, label: string, body: string, paths: string[]): ToolOutcome {
  return {
    content: fencedResult(body),
    lookup: { tool, label, paths: [...new Set(paths)].slice(0, MAX_LOOKUP_PATHS) },
  };
}

function formatDefinition(index: CodeLookupIndex, definition: SymbolDefinition): string {
  const last = Math.min(definition.endLine, definition.line + MAX_DEFINITION_LINES - 1);
  const numbered = index
    .readLines(definition.path, definition.line, last)
    .map((text, offset) => `${definition.line + offset}: ${text}`);
  return [`${definition.path}:${definition.line}-${definition.endLine}`, ...numbered].join("\n");
}

function findDefinition(index: CodeLookupIndex, currentPath: string, input: unknown): ToolOutcome {
  const { name } = NameInput.parse(input);
  const definitions = index.definitionsOf(name, currentPath).slice(0, MAX_DEFINITIONS);
  const body =
    definitions.length === 0
      ? `No definition of \`${name}\` found.`
      : definitions.map((definition) => formatDefinition(index, definition)).join("\n\n");
  return outcome(
    "find_definition",
    `Definition of \`${name}\` (${definitions.length})`,
    body,
    definitions.map((definition) => definition.path),
  );
}

function formatReference(reference: Reference): string {
  return `${reference.path}:${reference.line}: ${reference.text.trim()}`;
}

function formatReferences(references: Reference[], emptyMessage: string): string {
  return references.length === 0 ? emptyMessage : references.map(formatReference).join("\n");
}

async function findReferences(index: CodeLookupIndex, input: unknown): Promise<ToolOutcome> {
  const { name } = NameInput.parse(input);
  const references = (await index.referencesTo(name)).slice(0, MAX_LOOKUP_RESULTS);
  return outcome(
    "find_references",
    `Callers and uses of \`${name}\` (${references.length})`,
    formatReferences(references, `No uses of \`${name}\` found.`),
    references.map((reference) => reference.path),
  );
}

async function searchCode(index: CodeLookupIndex, input: unknown): Promise<ToolOutcome> {
  const { query } = QueryInput.parse(input);
  const matches = (await index.search(query)).slice(0, MAX_LOOKUP_RESULTS);
  return outcome(
    "search_code",
    `Search for \`${query}\` (${matches.length})`,
    formatReferences(matches, `Nothing matches \`${query}\`.`),
    matches.map((match) => match.path),
  );
}

async function readTrackedFile(
  index: CodeLookupIndex,
  trackedFiles: () => Promise<Set<string>>,
  input: unknown,
): Promise<ToolOutcome> {
  const { path: file, start_line: start, end_line: requestedEnd } = ReadInput.parse(input);
  if (!(await trackedFiles()).has(file)) throw new Error(`Not a tracked file: ${file}`);
  const end = Math.min(requestedEnd, start + MAX_READ_LINES - 1);
  const body = index
    .readLines(file, start, end)
    .map((text, offset) => `${start + offset}: ${text}`)
    .join("\n");
  return outcome("read_file", `Read \`${file}\` L${start}–L${end}`, body, [file]);
}

export function codeTools(index: CodeLookupIndex, currentPath: string): ToolBox {
  const trackedFiles = memoized(async () => new Set(await index.listFiles()));
  const handlers = new Map<string, (input: unknown) => Promise<ToolOutcome>>([
    ["find_definition", async (input) => findDefinition(index, currentPath, input)],
    ["find_references", (input) => findReferences(index, input)],
    ["search_code", (input) => searchCode(index, input)],
    ["read_file", (input) => readTrackedFile(index, trackedFiles, input)],
  ]);
  return {
    specs: SPECS,
    run: async (name, input) => {
      const handler = handlers.get(name);
      if (!handler) throw new Error(`Unknown tool: ${name}`);
      return handler(input);
    },
  };
}
