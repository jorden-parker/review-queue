import path from "node:path";
import type { ServerLocation } from "@/lib/lsp/client";
import { hoverSummary } from "@/lib/lsp/hover-summary";
import type { ClientFor } from "@/lib/lsp/pool";
import type { SymbolIndex } from "@/lib/symbols/symbol-index";
import type { SymbolPosition } from "@/lib/types";
import {
  definitionsWithCode,
  highlightReferences,
  referencesWithCode,
  scopeOf,
  withCode,
  type DefinitionWithCode,
  type PeekIndex,
  type ReferenceWithCode,
} from "./peek-code";
import { importSourceOf, isImportStatement, rankByImportSource } from "./import-binding";

export type Navigation = {
  index: PeekIndex & Pick<SymbolIndex, "filesMentioning" | "linkedPackageDirectory">;
  clientFor: ClientFor;
};

type ServerAnswer = { definitions: DefinitionWithCode[]; unresolvedImport: string | null };

async function clientAt({ clientFor }: Navigation, position: SymbolPosition) {
  return position.side === "new" ? clientFor(position.path) : null;
}

function externalDefinition(
  position: SymbolPosition,
  location: ServerLocation,
  hover: string | null,
): DefinitionWithCode {
  const summary = hoverSummary(hover ?? position.name);
  return {
    name: position.name,
    kind: summary.kind,
    path: path.basename(location.file),
    line: location.line,
    endLine: location.line,
    lines: [],
    tokens: [],
    source: "lsp",
    scope: "external",
    signature: summary.signature,
    hover,
  };
}

async function locatedDefinition(
  navigation: Navigation,
  position: SymbolPosition,
  location: ServerLocation,
  hover: string | null,
): Promise<DefinitionWithCode> {
  const file = navigation.index.relativePath(location.file);
  if (file === null) return externalDefinition(position, location, hover);
  const found = await withCode(navigation.index, {
    name: position.name,
    kind: hoverSummary(hover ?? "").kind,
    path: file,
    line: location.line,
    endLine: location.endLine,
    source: "lsp",
    scope: scopeOf(file, position.path),
    hover,
  });
  return hover ? { ...found, signature: hoverSummary(hover).signature } : found;
}

function importStatementAt(index: Navigation["index"], location: ServerLocation): string | null {
  const file = index.relativePath(location.file);
  if (file === null) return null;
  const statement = index.readLines(file, location.declarationLine, location.endLine).join("\n");
  return isImportStatement(statement) ? statement : null;
}

function unresolvedImportIn(
  index: Navigation["index"],
  locations: ServerLocation[],
): string | null {
  if (locations.length === 0) return null;
  const statements = locations.map((location) => importStatementAt(index, location));
  return statements.every((statement) => statement !== null) ? statements[0] : null;
}

async function serverDefinitions(
  navigation: Navigation,
  position: SymbolPosition,
): Promise<ServerAnswer> {
  const client = await clientAt(navigation, position);
  if (!client) return { definitions: [], unresolvedImport: null };
  const { path: file, line, character } = position;
  const [locations, hover] = await Promise.all([
    client.definition(file, line, character),
    client.hover(file, line, character).catch(() => null),
  ]);
  const definitions = await Promise.all(
    locations.map((location) => locatedDefinition(navigation, position, location, hover)),
  );
  return { definitions, unresolvedImport: unresolvedImportIn(navigation.index, locations) };
}

async function indexedDefinitions(
  navigation: Navigation,
  position: SymbolPosition,
  importStatement: string,
): Promise<DefinitionWithCode[]> {
  const found = await definitionsWithCode(navigation.index, position.name, position.path);
  const source = importSourceOf(position.path, importStatement, (name) =>
    navigation.index.linkedPackageDirectory(name),
  );
  return rankByImportSource(found, source);
}

export async function definitionsAt(
  navigation: Navigation,
  position: SymbolPosition,
): Promise<DefinitionWithCode[]> {
  const answer = await serverDefinitions(navigation, position).catch((): ServerAnswer => ({
    definitions: [],
    unresolvedImport: null,
  }));
  if (answer.unresolvedImport !== null) {
    const indexed = await indexedDefinitions(navigation, position, answer.unresolvedImport);
    if (indexed.length > 0) return indexed;
  }
  if (answer.definitions.length > 0) return answer.definitions;
  return definitionsWithCode(navigation.index, position.name, position.path);
}

async function serverReferences(
  navigation: Navigation,
  position: SymbolPosition,
): Promise<ReferenceWithCode[] | null> {
  const client = await clientAt(navigation, position);
  if (!client) return null;
  const related = await navigation.index.filesMentioning(position.name);
  const locations = await client.references(
    position.path,
    position.line,
    position.character,
    related,
  );
  const inside = locations.flatMap((location) => {
    const file = navigation.index.relativePath(location.file);
    if (file === null) return [];
    const [text = ""] = navigation.index.readLines(file, location.line, location.line);
    return [{ path: file, line: location.line, text }];
  });
  return highlightReferences(inside);
}

async function unresolvedImportAt(
  navigation: Navigation,
  position: SymbolPosition,
): Promise<string | null> {
  const client = await clientAt(navigation, position);
  if (!client) return null;
  const locations = await client.definition(position.path, position.line, position.character);
  return unresolvedImportIn(navigation.index, locations);
}

export async function referencesAt(
  navigation: Navigation,
  position: SymbolPosition,
): Promise<ReferenceWithCode[]> {
  const unresolvedImport = await unresolvedImportAt(navigation, position).catch(() => null);
  if (unresolvedImport !== null) return referencesWithCode(navigation.index, position.name);
  const found = await serverReferences(navigation, position).catch(() => null);
  if (found && found.length > 0) return found;
  return referencesWithCode(navigation.index, position.name);
}
