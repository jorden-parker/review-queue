import type { Hunk } from "@/lib/types";

export type ContextGap = { from: number; to: number | null; oldOffset: number };

export type LayoutItem = { kind: "gap"; gap: ContextGap } | { kind: "hunk"; index: number };

type Range = { first: number; last: number };
type Span = { old: Range; new: Range };

function rangeOf(start: number, count: number): Range {
  const first = count > 0 ? start : start + 1;
  return { first, last: first + count - 1 };
}

function spanOf(hunk: Hunk): Span {
  const oldCount = hunk.lines.filter((line) => line.oldLine !== null).length;
  const newCount = hunk.lines.filter((line) => line.newLine !== null).length;
  return { old: rangeOf(hunk.oldStart, oldCount), new: rangeOf(hunk.newStart, newCount) };
}

function gapBefore(spans: Span[], index: number): ContextGap {
  const span = spans[index];
  const from = index > 0 ? spans[index - 1].new.last + 1 : 1;
  return { from, to: span.new.first - 1, oldOffset: span.old.first - span.new.first };
}

function gapAfter(spans: Span[], index: number, lineCount: number | null): ContextGap {
  const span = spans[index];
  const next = spans[index + 1];
  return {
    from: span.new.last + 1,
    to: next ? next.new.first - 1 : lineCount,
    oldOffset: span.old.last - span.new.last,
  };
}

function hasLines(gap: ContextGap): boolean {
  return gap.to === null || gap.to >= gap.from;
}

export function fileLayout(hunks: Hunk[], shown: number[], lineCount: number | null): LayoutItem[] {
  const spans = hunks.map(spanOf);
  const shownSet = new Set(shown);
  const items: LayoutItem[] = [];
  const pushGap = (gap: ContextGap) => {
    if (hasLines(gap)) items.push({ kind: "gap", gap });
  };
  for (const index of [...shownSet].sort((a, b) => a - b)) {
    if (!shownSet.has(index - 1)) pushGap(gapBefore(spans, index));
    items.push({ kind: "hunk", index });
    pushGap(gapAfter(spans, index, lineCount));
  }
  return items;
}
