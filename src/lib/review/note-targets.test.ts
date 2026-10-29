import { describe, expect, it } from "vitest";
import type { FileDiff, Note } from "@/lib/types";
import { notesOffTheDiff } from "./note-targets";

function file(path: string, newLines: number[]): FileDiff {
  return {
    path,
    oldPath: path,
    status: "modified",
    binary: false,
    additions: newLines.length,
    deletions: 0,
    hunks: [
      {
        header: "",
        oldStart: 1,
        newStart: newLines[0] ?? 1,
        lines: newLines.map((newLine) => ({ kind: "add", text: "", oldLine: null, newLine })),
      },
    ],
  };
}

function note(id: number, path: string | null, line: number | null): Note {
  return { id, path, line, kind: "nitpick", decorations: [], body: "x", createdAt: "" };
}

describe("notesOffTheDiff", () => {
  const files = [file("a.ts", [10, 11, 12]), file("b.ts", [3])];

  it("keeps a note whose path and new-side line are in the diff", () => {
    expect(notesOffTheDiff([note(1, "a.ts", 11)], files)).toEqual([]);
  });

  it("names a note whose line is not a new-side line of its file", () => {
    expect(notesOffTheDiff([note(2, "a.ts", 13)], files)).toEqual([note(2, "a.ts", 13)]);
  });

  it("names a note whose file is not in the diff", () => {
    expect(notesOffTheDiff([note(3, "c.ts", 1)], files)).toEqual([note(3, "c.ts", 1)]);
  });

  it("never names a general note", () => {
    expect(notesOffTheDiff([note(4, null, null)], files)).toEqual([]);
  });

  it("counts context lines as part of the diff", () => {
    const withContext = file("d.ts", [1]);
    withContext.hunks[0].lines.push({ kind: "context", text: "", oldLine: 2, newLine: 2 });
    expect(notesOffTheDiff([note(5, "d.ts", 2)], [withContext])).toEqual([]);
  });
});
