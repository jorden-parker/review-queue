import type { ClientFor } from "@/lib/lsp/pool";
import type { SymbolIndex } from "@/lib/symbols/symbol-index";
import type { FileDiff, ReferenceCount, SymbolDefinition } from "@/lib/types";
import type { PreparedFile } from "./prepare";

export type CountSource = {
  index: Pick<SymbolIndex, "definitionsIn" | "referencesTo" | "relativePath">;
  clientFor: ClientFor;
};

type Declaration = Omit<ReferenceCount, "count">;

const IDENTIFIER_CHARACTER = /[\w$]/;

function isIdentifierCharacter(character: string | undefined): boolean {
  return character !== undefined && IDENTIFIER_CHARACTER.test(character);
}

function wordColumn(text: string, name: string): number | null {
  for (let column = text.indexOf(name); column >= 0; column = text.indexOf(name, column + 1)) {
    const before = text[column - 1];
    const after = text[column + name.length];
    if (!isIdentifierCharacter(before) && !isIdentifierCharacter(after)) return column;
  }
  return null;
}

function newSideLines(file: FileDiff): Map<number, string> {
  const lines = new Map<number, string>();
  for (const line of file.hunks.flatMap((hunk) => hunk.lines)) {
    if (line.newLine !== null) lines.set(line.newLine, line.text);
  }
  return lines;
}

export function lensDeclarations(file: FileDiff, definitions: SymbolDefinition[]): Declaration[] {
  const lines = newSideLines(file);
  return definitions.flatMap((definition) => {
    const text = lines.get(definition.line);
    if (definition.kind === "parameter" || text === undefined) return [];
    const character = wordColumn(text, definition.name);
    return character === null ? [] : [{ name: definition.name, line: definition.line, character }];
  });
}

async function serverCount(
  source: CountSource,
  path: string,
  declaration: Declaration,
): Promise<number | null> {
  const client = await source.clientFor(path);
  if (!client) return null;
  const locations = await client.references(path, declaration.line, declaration.character);
  return locations.filter((location) => source.index.relativePath(location.file) !== null).length;
}

async function textualCount(source: CountSource, name: string): Promise<number> {
  return Math.max(0, (await source.index.referencesTo(name)).length - 1);
}

async function countAll(source: CountSource, file: PreparedFile): Promise<ReferenceCount[]> {
  const counts: ReferenceCount[] = [];
  for (const declaration of lensDeclarations(file, source.index.definitionsIn(file.path))) {
    const fromServer = await serverCount(source, file.path, declaration).catch(() => null);
    const count = fromServer ?? (await textualCount(source, declaration.name));
    counts.push({ ...declaration, count });
  }
  return counts;
}

const computed = new WeakMap<CountSource, Map<string, Promise<ReferenceCount[]>>>();

export function referenceCountsIn(
  source: CountSource,
  file: PreparedFile,
): Promise<ReferenceCount[]> {
  const byPath = computed.get(source) ?? new Map<string, Promise<ReferenceCount[]>>();
  computed.set(source, byPath);
  if (!byPath.has(file.path)) {
    const pending = countAll(source, file);
    pending.catch(() => byPath.delete(file.path));
    byPath.set(file.path, pending);
  }
  return byPath.get(file.path)!;
}
