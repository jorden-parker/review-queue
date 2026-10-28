import type { DiffLine, Hunk } from "@/lib/types";

export const ASSIST_ACTIONS = ["explain", "simplify", "comment", "ask", "check"] as const;

export type AssistAction = (typeof ASSIST_ACTIONS)[number];

export const ASSIST_ERROR_MARKER = "\u0000";

export type AssistLookup = { tool: string; label: string; paths: string[] };

export const MAX_HISTORY_TURNS = 10;

export type LinePosition = { hunk: number; line: number };

export type LineRange = { path: string; from: LinePosition; to: LinePosition };

type StepCheckTarget = { kind: "check"; stepId: string; check: number; path: string };

export type AssistTarget =
  { kind: "lines"; range: LineRange } | { kind: "file"; path: string } | StepCheckTarget;

export type AssistTurn = { role: "reviewer" | "model"; text: string; lookups?: AssistLookup[] };

export type AssistThread = {
  id: string;
  headSha: string;
  target: AssistTarget;
  action: AssistAction;
  question: string | null;
  turns: AssistTurn[];
};

export type SavedAssistThread = AssistThread & { updatedAt: string };

type FileLine = LinePosition & { path: string };

export function isBefore(a: LinePosition, b: LinePosition): boolean {
  return a.hunk < b.hunk || (a.hunk === b.hunk && a.line < b.line);
}

export function orderedRange(anchor: FileLine, focus: FileLine): LineRange | null {
  if (anchor.path !== focus.path) return null;
  const [first, last] = isBefore(focus, anchor) ? [focus, anchor] : [anchor, focus];
  return {
    path: anchor.path,
    from: { hunk: first.hunk, line: first.line },
    to: { hunk: last.hunk, line: last.line },
  };
}

export function linesInRange(hunks: Hunk[], from: LinePosition, to: LinePosition): DiffLine[] {
  return hunks.slice(from.hunk, to.hunk + 1).flatMap((hunk, offset) => {
    const hunkIndex = from.hunk + offset;
    const start = hunkIndex === from.hunk ? from.line : 0;
    const end = hunkIndex === to.hunk ? to.line + 1 : hunk.lines.length;
    return hunk.lines.slice(start, end);
  });
}

function lineNumber(line: DiffLine | undefined): number | null {
  return line ? (line.newLine ?? line.oldLine) : null;
}

function rangeLabel(hunks: Hunk[], range: LineRange): string {
  const lines = linesInRange(hunks, range.from, range.to);
  const first = lineNumber(lines[0]);
  const last = lineNumber(lines.at(-1));
  const span = first === last ? `L${first}` : `L${first}–L${last}`;
  return `${range.path} ${span}`;
}

function commentLine(hunks: Hunk[], from: LinePosition, to: LinePosition): number | null {
  const newSide = linesInRange(hunks, from, to).filter((line) => line.newLine !== null);
  return newSide.at(-1)?.newLine ?? null;
}

export function targetPath(target: AssistTarget): string {
  return target.kind === "lines" ? target.range.path : target.path;
}

function shortLabel(target: Exclude<AssistTarget, { kind: "lines" }>): string {
  return target.kind === "file"
    ? `${target.path} (whole file)`
    : `${target.path} (step check ${target.check + 1})`;
}

export function targetLabel(hunks: Hunk[], target: AssistTarget): string {
  return target.kind === "lines" ? rangeLabel(hunks, target.range) : shortLabel(target);
}

export function targetCommentLine(hunks: Hunk[], target: AssistTarget): number | null {
  return target.kind === "lines" ? commentLine(hunks, target.range.from, target.range.to) : null;
}

export function targetFirstLine(hunks: Hunk[], target: AssistTarget): number {
  const first = target.kind === "lines" ? target.range.from : { hunk: 0, line: 0 };
  return lineNumber(hunks[first.hunk]?.lines[first.line]) ?? 1;
}
