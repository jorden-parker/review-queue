import { createRequire } from "node:module";
import path from "node:path";
import type * as TreeSitter from "@vscode/tree-sitter-wasm";
import type { SymbolDefinition, SymbolKind } from "@/lib/types";
import { languageFor, type LanguageSpec } from "./languages";

type Runtime = typeof TreeSitter;
type Compiled = { parser: TreeSitter.Parser; query: TreeSitter.Query };

const require = createRequire(path.join(process.cwd(), "package.json"));
const compiled = new Map<string, Promise<Compiled>>();
let runtime: Promise<Runtime> | null = null;

function wasmDirectory(): string {
  return path.dirname(require.resolve("@vscode/tree-sitter-wasm"));
}

async function loadRuntime(): Promise<Runtime> {
  const treeSitter = require("@vscode/tree-sitter-wasm") as Runtime;
  await treeSitter.Parser.init({ locateFile: (file) => path.join(wasmDirectory(), file) });
  return treeSitter;
}

async function compile(spec: LanguageSpec): Promise<Compiled> {
  runtime ??= loadRuntime();
  const treeSitter = await runtime;
  const language = await treeSitter.Language.load(
    path.join(wasmDirectory(), `tree-sitter-${spec.grammar}.wasm`),
  );
  const parser = new treeSitter.Parser();
  parser.setLanguage(language);
  return { parser, query: new treeSitter.Query(language, spec.definitionQuery) };
}

export function compiledFor(spec: LanguageSpec): Promise<Compiled> {
  const key = spec.grammar;
  if (!compiled.has(key)) compiled.set(key, compile(spec));
  return compiled.get(key)!;
}

function definitionNode(node: TreeSitter.Node): TreeSitter.Node {
  return node.parent ?? node;
}

export async function parseDefinitions(file: string, source: string): Promise<SymbolDefinition[]> {
  const spec = languageFor(file);
  if (!spec) return [];
  const { parser, query } = await compiledFor(spec);
  const tree = parser.parse(source);
  if (!tree) return [];
  const seen = new Set<string>();
  const definitions: SymbolDefinition[] = [];
  for (const capture of query.captures(tree.rootNode)) {
    const owner = definitionNode(capture.node);
    const line = capture.node.startPosition.row + 1;
    const key = `${capture.node.text}:${line}`;
    if (seen.has(key)) continue;
    seen.add(key);
    definitions.push({
      name: capture.node.text,
      kind: capture.name as SymbolKind,
      path: file,
      line,
      endLine: owner.endPosition.row + 1,
    });
  }
  tree.delete();
  return definitions;
}
