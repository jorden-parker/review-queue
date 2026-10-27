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

export type Navigation = {
  index: PeekIndex & Pick<SymbolIndex, "filesMentioning">;
  clientFor: ClientFor;
};

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

async function serverDefinitions(
  navigation: Navigation,
  position: SymbolPosition,
): Promise<DefinitionWithCode[]> {
  const client = await clientAt(navigation, position);
  if (!client) return [];
  const { path: file, line, character } = position;
  const [locations, hover] = await Promise.all([
    client.definition(file, line, character),
    client.hover(file, line, character).catch(() => null),
  ]);
  return Promise.all(
    locations.map((location) => locatedDefinition(navigation, position, location, hover)),
  );
}

export async function definitionsAt(
  navigation: Navigation,
  position: SymbolPosition,
): Promise<DefinitionWithCode[]> {
  const found = await serverDefinitions(navigation, position).catch(() => []);
  if (found.length > 0) return found;
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

export async function referencesAt(
  navigation: Navigation,
  position: SymbolPosition,
): Promise<ReferenceWithCode[]> {
  const found = await serverReferences(navigation, position).catch(() => null);
  return found ?? referencesWithCode(navigation.index, position.name);
}
