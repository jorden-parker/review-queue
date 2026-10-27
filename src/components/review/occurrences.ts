import type { PeekState } from "./use-peek";

export type OccurrenceKind = "definition" | "reference";

export type Occurrences = { name: string; byLine: Map<string, OccurrenceKind> };

function lineKey(path: string, line: number): string {
  return `${path}:${line}`;
}

function markIfAbsent(byLine: Map<string, OccurrenceKind>, path: string, line: number) {
  const key = lineKey(path, line);
  if (!byLine.has(key)) byLine.set(key, "reference");
}

function markReferences(peek: PeekState, byLine: Map<string, OccurrenceKind>) {
  markIfAbsent(byLine, peek.position.path, peek.position.line);
  for (const reference of peek.references ?? [])
    markIfAbsent(byLine, reference.path, reference.line);
}

function markDefinitions(peek: PeekState, byLine: Map<string, OccurrenceKind>) {
  for (const definition of peek.definitions ?? []) {
    byLine.set(lineKey(definition.path, definition.line), "definition");
  }
}

export function occurrencesOf(peek: PeekState | null): Occurrences | null {
  if (!peek) return null;
  const byLine = new Map<string, OccurrenceKind>();
  markReferences(peek, byLine);
  markDefinitions(peek, byLine);
  return { name: peek.position.name, byLine };
}

export function occurrenceAt(
  occurrences: Occurrences | null,
  path: string,
  line: number | null,
): OccurrenceKind | null {
  if (!occurrences || line === null) return null;
  return occurrences.byLine.get(lineKey(path, line)) ?? null;
}
