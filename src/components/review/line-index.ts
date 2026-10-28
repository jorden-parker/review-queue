export type FileLine = { path: string; line: number };

export function indexByLine<T>(
  items: readonly T[],
  positionOf: (item: T) => FileLine | null,
): Map<string, T[]> {
  const index = new Map<string, T[]>();
  for (const item of items) {
    const position = positionOf(item);
    if (position === null) continue;
    const key = fileLineKey(position.path, position.line);
    const bucket = index.get(key);
    if (bucket) bucket.push(item);
    else index.set(key, [item]);
  }
  return index;
}

export function linesAt<T>(
  index: ReadonlyMap<string, T[]>,
  path: string,
  line: number | null,
): T[] {
  if (line === null) return [];
  return index.get(fileLineKey(path, line)) ?? [];
}

function fileLineKey(path: string, line: number): string {
  return `${path}:${line}`;
}
