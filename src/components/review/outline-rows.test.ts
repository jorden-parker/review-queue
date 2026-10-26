import { describe, expect, it } from "vitest";
import type { OutlineSymbol } from "@/lib/types";
import { addedHunk, fileDiff } from "@/test/diff-builders";
import { diffLinesOf, outlineRows, symbolKey } from "./outline-rows";

function node(
  name: string,
  line: number,
  endLine: number,
  children: OutlineSymbol[] = [],
): OutlineSymbol {
  return { name, kind: "function", path: "src/a.ts", line, endLine, children };
}

const TREE = [
  node("Store", 1, 20, [node("load", 2, 5), node("save", 10, 12)]),
  node("helper", 30, 32),
];

const EMPTY_DIFF = { shown: new Set<number>(), changed: new Set<number>() };

describe("outlineRows", () => {
  it("flattens the tree depth first with each row's depth", () => {
    const rows = outlineRows(TREE, new Set(), EMPTY_DIFF);
    expect(rows.map((row) => [row.symbol.name, row.depth, row.hasChildren])).toEqual([
      ["Store", 0, true],
      ["load", 1, false],
      ["save", 1, false],
      ["helper", 0, false],
    ]);
  });

  it("hides the children of collapsed symbols", () => {
    const rows = outlineRows(TREE, new Set([symbolKey(TREE[0])]), EMPTY_DIFF);
    expect(rows.map((row) => [row.symbol.name, row.expanded])).toEqual([
      ["Store", false],
      ["helper", true],
    ]);
  });

  it("marks symbols declared on a shown line and symbols with changed lines", () => {
    const diff = { shown: new Set([2, 3, 30]), changed: new Set([11]) };
    const rows = outlineRows(TREE, new Set(), diff);
    expect(rows.map((row) => [row.symbol.name, row.shown, row.changed])).toEqual([
      ["Store", false, true],
      ["load", true, false],
      ["save", false, true],
      ["helper", true, false],
    ]);
  });
});

describe("diffLinesOf", () => {
  it("collects new-side lines of the given hunks and which of them were added", () => {
    const hunk = addedHunk(["a", "b"], 5);
    hunk.lines.unshift({ kind: "context", text: "z", oldLine: 3, newLine: 4 });
    const file = fileDiff("src/a.ts", [hunk, addedHunk(["c"], 40)]);
    const lines = diffLinesOf(file, [0]);
    expect([...lines.shown]).toEqual([4, 5, 6]);
    expect([...lines.changed]).toEqual([5, 6]);
  });
});
