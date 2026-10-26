import { highlightLines, type Token } from "@/lib/highlight";
import type { Reference, SymbolIndex } from "@/lib/symbols/symbol-index";
import type { DefinitionScope, SymbolDefinition } from "@/lib/types";

export type PeekIndex = Pick<
  SymbolIndex,
  "definitionsOf" | "readLines" | "referencesTo" | "relativePath"
>;

export type DefinitionWithCode = SymbolDefinition & {
  lines: string[];
  tokens: Token[][];
  source: "lsp" | "index";
  scope: DefinitionScope;
  signature: string;
  hover: string | null;
};

export type ReferenceWithCode = Reference & { tokens: Token[] };

type Located = Omit<DefinitionWithCode, "lines" | "tokens" | "signature">;

const SNIPPET_LINES = 40;

export async function withCode(index: PeekIndex, located: Located): Promise<DefinitionWithCode> {
  const last = Math.min(located.endLine, located.line + SNIPPET_LINES - 1);
  const lines = index.readLines(located.path, located.line, last);
  const tokens = await highlightLines(located.path, lines);
  return { ...located, lines, tokens, signature: lines[0]?.trim() ?? "" };
}

export function scopeOf(path: string, fromFile: string): DefinitionScope {
  return path === fromFile ? "file" : "repo";
}

export function definitionsWithCode(
  index: PeekIndex,
  name: string,
  fromFile: string,
): Promise<DefinitionWithCode[]> {
  return Promise.all(
    index.definitionsOf(name, fromFile).map((found) =>
      withCode(index, {
        ...found,
        source: "index",
        scope: scopeOf(found.path, fromFile),
        hover: null,
      }),
    ),
  );
}

export function highlightReferences(references: Reference[]): Promise<ReferenceWithCode[]> {
  return Promise.all(
    references.map(async (reference) => {
      const text = reference.text.trim();
      const [tokens] = await highlightLines(reference.path, [text]);
      return { ...reference, text, tokens };
    }),
  );
}

export async function referencesWithCode(
  index: PeekIndex,
  name: string,
): Promise<ReferenceWithCode[]> {
  return highlightReferences(await index.referencesTo(name));
}
