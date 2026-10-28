import { describe, expect, it } from "vitest";
import { indexByLine, linesAt } from "./line-index";

type Item = { id: string; path: string; line: number | null };

const ITEMS: Item[] = [
  { id: "first", path: "src/a.ts", line: 3 },
  { id: "second", path: "src/a.ts", line: 3 },
  { id: "unplaced", path: "src/a.ts", line: null },
  { id: "elsewhere", path: "src/b.ts", line: 3 },
];

function positionOf(item: Item) {
  return item.line === null ? null : { path: item.path, line: item.line };
}

function idsOf(items: Item[]): string[] {
  return items.map((item) => item.id);
}

describe("indexByLine", () => {
  it("groups items by path and line, keeps their order, and skips items with no position", () => {
    const index = indexByLine(ITEMS, positionOf);
    expect(idsOf(linesAt(index, "src/a.ts", 3))).toEqual(["first", "second"]);
    expect(idsOf(linesAt(index, "src/b.ts", 3))).toEqual(["elsewhere"]);
    expect(idsOf([...index.values()].flat())).not.toContain("unplaced");
  });
});

describe("linesAt", () => {
  it("returns nothing when the line is null", () => {
    const index = indexByLine(ITEMS, positionOf);
    expect(linesAt(index, "src/a.ts", null)).toEqual([]);
  });

  it("returns nothing for a line that has no items", () => {
    const index = indexByLine(ITEMS, positionOf);
    expect(linesAt(index, "src/a.ts", 99)).toEqual([]);
  });
});
