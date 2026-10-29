import type { LineRange } from "@/lib/assist-protocol";
import type { DiffLine, DiffSide, Hunk } from "@/lib/types";

export type NoteAnchor = { path: string; side: DiffSide; startLine: number; line: number };

function spanOf(hunk: Hunk, fromLine: number, toLine: number): DiffLine[] | null {
  if (fromLine < 0 || toLine >= hunk.lines.length || fromLine > toLine) return null;
  return hunk.lines.slice(fromLine, toLine + 1);
}

function sideOf(lines: DiffLine[]): DiffSide {
  return lines.some((line) => line.newLine !== null) ? "new" : "old";
}

function numbersOn(lines: DiffLine[], side: DiffSide): number[] {
  return lines
    .map((line) => (side === "new" ? line.newLine : line.oldLine))
    .filter((number): number is number => number !== null);
}

export function noteAnchorOf(hunks: readonly Hunk[], range: LineRange): NoteAnchor | null {
  if (range.from.hunk !== range.to.hunk) return null;
  const hunk = hunks[range.from.hunk];
  if (hunk === undefined) return null;
  const lines = spanOf(hunk, range.from.line, range.to.line);
  if (lines === null) return null;
  const side = sideOf(lines);
  const numbers = numbersOn(lines, side);
  if (numbers.length < 2) return null;
  return {
    path: range.path,
    side,
    startLine: numbers[0],
    line: numbers[numbers.length - 1],
  };
}
