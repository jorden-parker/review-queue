import { describe, expect, it } from "vitest";
import { addedHunk, removedHunk } from "@/test/diff-builders";
import {
  commentLine,
  firstLineNumber,
  linesInRange,
  orderedRange,
  rangeLabel,
} from "./assist-protocol";

const HUNKS = [addedHunk(["a1", "a2", "a3"], 1), addedHunk(["b1", "b2"], 20)];

describe("orderedRange", () => {
  it("orders a selection made bottom-up", () => {
    const range = orderedRange(
      { path: "a.ts", hunk: 1, line: 0 },
      { path: "a.ts", hunk: 0, line: 2 },
    );
    expect(range).toEqual({ path: "a.ts", from: { hunk: 0, line: 2 }, to: { hunk: 1, line: 0 } });
  });

  it("refuses a selection across files", () => {
    expect(
      orderedRange({ path: "a.ts", hunk: 0, line: 0 }, { path: "b.ts", hunk: 0, line: 0 }),
    ).toBeNull();
  });
});

describe("linesInRange", () => {
  it("slices across hunks", () => {
    const lines = linesInRange(HUNKS, { hunk: 0, line: 1 }, { hunk: 1, line: 0 });
    expect(lines.map((line) => line.text)).toEqual(["a2", "a3", "b1"]);
  });
});

describe("rangeLabel", () => {
  it("names the file and the first and last line numbers", () => {
    const range = { path: "src/a.ts", from: { hunk: 0, line: 1 }, to: { hunk: 1, line: 1 } };
    expect(rangeLabel(HUNKS, range)).toBe("src/a.ts L2–L21");
  });

  it("names a single line once", () => {
    const range = { path: "src/a.ts", from: { hunk: 0, line: 0 }, to: { hunk: 0, line: 0 } };
    expect(rangeLabel(HUNKS, range)).toBe("src/a.ts L1");
  });
});

describe("commentLine", () => {
  it("is the last new-side line", () => {
    expect(commentLine(HUNKS, { hunk: 0, line: 0 }, { hunk: 1, line: 1 })).toBe(21);
  });

  it("is null when only removed lines are selected", () => {
    expect(
      commentLine([removedHunk(["gone"])], { hunk: 0, line: 0 }, { hunk: 0, line: 0 }),
    ).toBeNull();
  });
});

describe("firstLineNumber", () => {
  it("is the number of the range's first line", () => {
    const range = { path: "src/a.ts", from: { hunk: 1, line: 1 }, to: { hunk: 1, line: 1 } };
    expect(firstLineNumber(HUNKS, range)).toBe(21);
  });
});
