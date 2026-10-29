import { describe, expect, it } from "vitest";
import type { LineRange } from "@/lib/assist-protocol";
import type { DiffLine, Hunk } from "@/lib/types";
import { noteAnchorOf } from "./note-range";

const context = (oldLine: number, newLine: number): DiffLine => ({
  kind: "context",
  text: "",
  oldLine,
  newLine,
});
const added = (newLine: number): DiffLine => ({ kind: "add", text: "", oldLine: null, newLine });
const removed = (oldLine: number): DiffLine => ({ kind: "del", text: "", oldLine, newLine: null });

function hunkOf(lines: DiffLine[]): Hunk {
  return { header: "", oldStart: 1, newStart: 1, lines };
}

function rangeOf(path: string, fromLine: number, toLine: number, hunk = 0): LineRange {
  return {
    path,
    from: { hunk, line: fromLine },
    to: { hunk, line: toLine },
  };
}

describe("noteAnchorOf", () => {
  const hunks = [
    hunkOf([context(3, 3), added(4), added(5), added(6), context(4, 7)]),
    hunkOf([removed(8), removed(9)]),
  ];

  it("anchors a span of added lines on the new side from its first line to its last", () => {
    expect(noteAnchorOf(hunks, rangeOf("a.ts", 1, 3))).toEqual({
      path: "a.ts",
      side: "new",
      startLine: 4,
      line: 6,
    });
  });

  it("anchors a replaced block on the added lines, not the deleted ones", () => {
    const replaced = [hunkOf([removed(4), removed(5), added(4), added(5)])];
    expect(noteAnchorOf(replaced, rangeOf("a.ts", 0, 3))).toEqual({
      path: "a.ts",
      side: "new",
      startLine: 4,
      line: 5,
    });
  });

  it("anchors a span of only deleted lines on the old side", () => {
    expect(noteAnchorOf(hunks, rangeOf("a.ts", 0, 1, 1))).toEqual({
      path: "a.ts",
      side: "old",
      startLine: 8,
      line: 9,
    });
  });

  it("returns null when the range starts and ends in different hunks", () => {
    const crossing: LineRange = {
      path: "a.ts",
      from: { hunk: 0, line: 1 },
      to: { hunk: 1, line: 0 },
    };
    expect(noteAnchorOf(hunks, crossing)).toBeNull();
  });

  it("returns null for a span that covers one line on its side", () => {
    expect(noteAnchorOf(hunks, rangeOf("a.ts", 1, 1))).toBeNull();
  });

  it("returns null when an index is outside the hunk or the hunk list", () => {
    expect(noteAnchorOf(hunks, rangeOf("a.ts", 1, 9))).toBeNull();
    expect(noteAnchorOf(hunks, rangeOf("a.ts", -1, 2))).toBeNull();
    expect(noteAnchorOf(hunks, rangeOf("a.ts", 1, 3, 5))).toBeNull();
  });
});
