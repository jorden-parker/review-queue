import { describe, expect, it } from "vitest";
import { runnableHunkMove } from "./hunk-move";

describe("runnableHunkMove", () => {
  it("holds a hunk move while a file is open, so the step view can mount first", () => {
    expect(runnableHunkMove(1, true)).toBeNull();
  });

  it("runs the pending hunk move once the file is closed", () => {
    expect(runnableHunkMove(2, false)).toBe(2);
    expect(runnableHunkMove(-1, false)).toBe(-1);
  });

  it("runs nothing when no move is pending", () => {
    expect(runnableHunkMove(0, false)).toBeNull();
  });
});
