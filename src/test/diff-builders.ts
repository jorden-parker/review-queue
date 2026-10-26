import type { DiffLine, FileDiff, Hunk } from "@/lib/types";

export function addedHunk(lines: string[], newStart = 1): Hunk {
  const diffLines: DiffLine[] = lines.map((text, offset) => ({
    kind: "add",
    text,
    oldLine: null,
    newLine: newStart + offset,
  }));
  return { header: "", oldStart: 0, newStart, lines: diffLines };
}

export function removedHunk(lines: string[], oldStart = 1): Hunk {
  const diffLines: DiffLine[] = lines.map((text, offset) => ({
    kind: "del",
    text,
    oldLine: oldStart + offset,
    newLine: null,
  }));
  return { header: "", oldStart, newStart: 0, lines: diffLines };
}

export function fileDiff(file: string, hunks: Hunk[], overrides: Partial<FileDiff> = {}): FileDiff {
  const lines = hunks.flatMap((hunk) => hunk.lines);
  return {
    path: file,
    oldPath: file,
    status: "modified",
    binary: false,
    additions: lines.filter((line) => line.kind === "add").length,
    deletions: lines.filter((line) => line.kind === "del").length,
    hunks,
    ...overrides,
  };
}

export function lines(count: number, text = "x"): string[] {
  return Array.from({ length: count }, (_, index) => `${text}${index}`);
}
