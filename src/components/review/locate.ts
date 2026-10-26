import type { PreparedFile } from "@/lib/review/prepare";
import type { Step } from "@/lib/types";

export type LineTarget = { path: string; line: number; name?: string };

export function isSameLine(target: LineTarget | null, path: string, line: number): boolean {
  return target?.path === path && target.line === line;
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

export function lineElementId(target: LineTarget): string {
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
