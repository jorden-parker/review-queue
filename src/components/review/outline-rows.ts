import type { FileDiff, OutlineSymbol } from "@/lib/types";

export type DiffLines = { shown: ReadonlySet<number>; changed: ReadonlySet<number> };

export type OutlineRow = {
  key: string;
  symbol: OutlineSymbol;
  depth: number;
  hasChildren: boolean;
  expanded: boolean;
  shown: boolean;
  changed: boolean;
};

export function symbolKey(symbol: OutlineSymbol): string {
  return `${symbol.path}:${symbol.line}:${symbol.name}`;
}

export function diffLinesOf(file: FileDiff, hunkIndexes: number[]): DiffLines {
  const lines = hunkIndexes.flatMap((index) => file.hunks[index]?.lines ?? []);
  const shown = new Set<number>();
  const changed = new Set<number>();
  for (const line of lines) {
    if (line.newLine === null) continue;
    shown.add(line.newLine);
    if (line.kind === "add") changed.add(line.newLine);
  }
  return { shown, changed };
}

function hasChangedLine(symbol: OutlineSymbol, changed: ReadonlySet<number>): boolean {
  return [...changed].some((line) => line >= symbol.line && line <= symbol.endLine);
}

export function outlineRows(
  tree: OutlineSymbol[],
  collapsed: ReadonlySet<string>,
  diff: DiffLines,
  depth = 0,
): OutlineRow[] {
  return tree.flatMap((symbol) => {
    const key = symbolKey(symbol);
    const expanded = !collapsed.has(key);
    const row: OutlineRow = {
      key,
      symbol,
      depth,
      hasChildren: symbol.children.length > 0,
      expanded,
      shown: diff.shown.has(symbol.line),
      changed: hasChangedLine(symbol, diff.changed),
    };
    const children = expanded ? outlineRows(symbol.children, collapsed, diff, depth + 1) : [];
    return [row, ...children];
  });
}
