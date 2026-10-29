import type { PreparedFile } from "@/lib/review/prepare";
import type { DiffLine, DiffSide, Step } from "@/lib/types";

export type LineTarget = {
  path: string;
  line: number;
  side?: DiffSide;
  endLine?: number;
  name?: string;
};

function isOnSide(target: LineTarget, side: DiffSide): boolean {
  return (target.side ?? "new") === side;
}

export function isSameLine(
  target: LineTarget | null,
  path: string,
  line: number,
  side: DiffSide = "new",
): boolean {
  return target?.path === path && target.line === line && isOnSide(target, side);
}

export function isInTarget(
  target: LineTarget | null,
  path: string,
  line: number,
  side: DiffSide = "new",
): boolean {
  if (target?.path !== path || !isOnSide(target, side)) return false;
  return line >= target.line && line <= (target.endLine ?? target.line);
}

export function noteTargetOf(path: string, line: DiffLine): LineTarget | null {
  if (line.newLine !== null) return { path, line: line.newLine };
  if (line.oldLine !== null) return { path, line: line.oldLine, side: "old" };
  return null;
}

function hunkContains(file: PreparedFile, hunkIndex: number, line: number): boolean {
  return file.hunks[hunkIndex].lines.some((diffLine) => diffLine.newLine === line);
}

export function stepForLine(steps: Step[], files: PreparedFile[], target: LineTarget): Step | null {
  const file = files.find((candidate) => candidate.path === target.path);
  if (!file) return null;
  const withPath = steps.filter((step) =>
    step.files.some((stepFile) => stepFile.path === target.path),
  );
  const exact = withPath.find((step) =>
    step.files.some(
      (stepFile) =>
        stepFile.path === target.path &&
        stepFile.hunkIndexes.some((index) => hunkContains(file, index, target.line)),
    ),
  );
  return exact ?? withPath[0] ?? null;
}

export function locationKind(
  prFiles: Pick<PreparedFile, "path">[],
  target: LineTarget,
): "diff" | "file" {
  return prFiles.some((file) => file.path === target.path) ? "diff" : "file";
}

export function lineElementId(target: LineTarget): string {
  if (target.side === "old") return `line-old-${target.path}-${target.line}`;
  return `line-${target.path}-${target.line}`;
}

export function nextOpenStep(
  steps: Step[],
  doneSteps: string[],
  afterId: string | null,
): Step | null {
  const start = afterId ? steps.findIndex((step) => step.id === afterId) + 1 : 0;
  const ordered = [...steps.slice(start), ...steps.slice(0, start)];
  return ordered.find((step) => !doneSteps.includes(step.id)) ?? null;
}
