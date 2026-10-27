import { describe, expect, it } from "vitest";
import { nextStopIndex } from "./map-keys";

describe("nextStopIndex", () => {
  it("moves down and up one stop, staying inside the list", () => {
    expect(nextStopIndex(0, "ArrowDown", 3)).toBe(1);
    expect(nextStopIndex(2, "ArrowDown", 3)).toBe(2);
    expect(nextStopIndex(1, "ArrowUp", 3)).toBe(0);
    expect(nextStopIndex(0, "ArrowUp", 3)).toBe(0);
  });

  it("jumps to the first and last stop", () => {
    expect(nextStopIndex(1, "Home", 3)).toBe(0);
    expect(nextStopIndex(1, "End", 3)).toBe(2);
  });

  it("starts at the first stop when nothing has focus", () => {
    expect(nextStopIndex(-1, "ArrowDown", 3)).toBe(0);
  });

  it("ignores other keys and empty lists", () => {
    expect(nextStopIndex(0, "j", 3)).toBeNull();
    expect(nextStopIndex(0, "ArrowDown", 0)).toBeNull();
  });
});
