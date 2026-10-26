import { highlightLines, type Token } from "@/lib/highlight";
import type { Reference, SymbolIndex } from "@/lib/symbols/symbol-index";
import type { SymbolDefinition } from "@/lib/types";

export type PeekIndex = Pick<SymbolIndex, "definitionsOf" | "readLines" | "referencesTo">;
export type DefinitionWithCode = SymbolDefinition & { lines: string[]; tokens: Token[][] };
export type ReferenceWithCode = Reference & { tokens: Token[] };

const SNIPPET_LINES = 40;

async function withCode(index: PeekIndex, definition: SymbolDefinition) {
  const last = Math.min(definition.endLine, definition.line + SNIPPET_LINES - 1);
  const lines = index.readLines(definition.path, definition.line, last);
  return { ...definition, lines, tokens: await highlightLines(definition.path, lines) };
}

export function definitionsWithCode(
  index: PeekIndex,
  name: string,
  fromFile: string,
): Promise<DefinitionWithCode[]> {
  return Promise.all(index.definitionsOf(name, fromFile).map((found) => withCode(index, found)));
}

export async function referencesWithCode(
  index: PeekIndex,
  name: string,
): Promise<ReferenceWithCode[]> {
  const references = await index.referencesTo(name);
  return Promise.all(
    references.map(async (reference) => {
      const text = reference.text.trim();
      const [tokens] = await highlightLines(reference.path, [text]);
      return { ...reference, text, tokens };
    }),
  );
}
