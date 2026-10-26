import type { PreparedFile } from "@/lib/review/prepare";
import type { Step } from "@/lib/types";
import type { LineTarget } from "./locate";

export function hunkElementId(path: string, hunkIndex: number): string {
  return `hunk-${path}-${hunkIndex}`;
}

export function hunkIdsFor(steps: Step[]): string[] {
  return steps.flatMap((step) =>
    step.files.flatMap((file) => file.hunkIndexes.map((index) => hunkElementId(file.path, index))),
  );
}

export function firstNoteLine(files: PreparedFile[], hunkId: string | null): LineTarget | null {
  const match = files
    .flatMap((file) => file.hunks.map((hunk, index) => ({ file, hunk, index })))
    .find(({ file, index }) => hunkElementId(file.path, index) === hunkId);
  if (!match) return null;
  const lines = match.hunk.lines;
  const line =
    lines.find((candidate) => candidate.kind === "add") ??
    lines.find((candidate) => candidate.newLine);
  return line?.newLine ? { path: match.file.path, line: line.newLine } : null;
}
