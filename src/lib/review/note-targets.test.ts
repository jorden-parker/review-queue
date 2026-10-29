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

function deletedFile(path: string, oldLines: number[]): FileDiff {
  const diff = file(path, []);
  diff.hunks[0].lines = oldLines.map((oldLine) => ({
    kind: "del",
    text: "",
    oldLine,
    newLine: null,
  }));
  return diff;
}

function note(
  id: number,
  path: string | null,
  line: number | null,
  side: Note["side"] = "new",
): Note {
  return {
    id,
    path,
    line,
    side,
    startLine: null,
    kind: "nitpick",
    decorations: [],
    body: "x",
    createdAt: "",
  };
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

  it("keeps an old-side note on a deleted line", () => {
    const removed = deletedFile("e.ts", [4, 5]);
    expect(notesOffTheDiff([note(6, "e.ts", 5, "old")], [removed])).toEqual([]);
  });

  it("names an old-side note whose line is only a new-side line", () => {
    expect(notesOffTheDiff([note(7, "a.ts", 11, "old")], files)).toEqual([
      note(7, "a.ts", 11, "old"),
    ]);
  });

  it("keeps a range note whose first and last lines share a hunk", () => {
    const range = { ...note(9, "a.ts", 12), startLine: 10 };
    expect(notesOffTheDiff([range], files)).toEqual([]);
  });

  it("names a range note whose first and last lines are in different hunks", () => {
    const spanning = file("c.ts", [10, 11]);
    spanning.hunks.push({
      header: "",
      oldStart: 20,
      newStart: 20,
      lines: [{ kind: "add", text: "", oldLine: null, newLine: 20 }],
    });
    const range = { ...note(10, "c.ts", 20), startLine: 11 };
    expect(notesOffTheDiff([range], [spanning])).toEqual([range]);
  });

  it("counts context lines as part of the diff", () => {
    const withContext = file("d.ts", [1]);
    withContext.hunks[0].lines.push({ kind: "context", text: "", oldLine: 2, newLine: 2 });
    expect(notesOffTheDiff([note(5, "d.ts", 2)], [withContext])).toEqual([]);
  });
});
