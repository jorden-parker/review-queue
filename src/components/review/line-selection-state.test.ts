import { describe, expect, it } from "vitest";
import { type LineSelection, sameLineSelection } from "./line-selection-state";

function selectionWith(overrides: Partial<LineSelection> = {}): LineSelection {
  return {
    range: {
      path: "src/a.ts",
      from: { hunk: 0, line: 1 },
      to: { hunk: 0, line: 2 },
    },
    top: 10,
    left: 20,
    ...overrides,
  };
}

describe("sameLineSelection", () => {
  it("treats two empty selections as the same", () => {
    expect(sameLineSelection(null, null)).toBe(true);
  });

  it("treats a selection and no selection as different, either way round", () => {
    expect(sameLineSelection(selectionWith(), null)).toBe(false);
    expect(sameLineSelection(null, selectionWith())).toBe(false);
  });

  it("treats equal selections as the same even when they are different objects", () => {
    expect(sameLineSelection(selectionWith(), selectionWith())).toBe(true);
  });

  it("treats a different top or left as a different selection", () => {
    expect(sameLineSelection(selectionWith(), selectionWith({ top: 11 }))).toBe(false);
    expect(sameLineSelection(selectionWith(), selectionWith({ left: 21 }))).toBe(false);
  });

  it("treats a different start line, end hunk or path as a different selection", () => {
    const moved = (range: Partial<LineSelection["range"]>) =>
      selectionWith({ range: { ...selectionWith().range, ...range } });
    expect(sameLineSelection(selectionWith(), moved({ from: { hunk: 0, line: 3 } }))).toBe(false);
    expect(sameLineSelection(selectionWith(), moved({ to: { hunk: 1, line: 2 } }))).toBe(false);
    expect(sameLineSelection(selectionWith(), moved({ path: "src/b.ts" }))).toBe(false);
  });
});
