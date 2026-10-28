import type { LinePosition, LineRange } from "@/lib/assist-protocol";

export type LineSelection = { range: LineRange; top: number; left: number };

export function sameLineSelection(
  previous: LineSelection | null,
  next: LineSelection | null,
): boolean {
  if (previous === null || next === null) return previous === next;
  return (
    previous.top === next.top &&
    previous.left === next.left &&
    previous.range.path === next.range.path &&
    samePosition(previous.range.from, next.range.from) &&
    samePosition(previous.range.to, next.range.to)
  );
}

function samePosition(first: LinePosition, second: LinePosition): boolean {
  return first.hunk === second.hunk && first.line === second.line;
}
