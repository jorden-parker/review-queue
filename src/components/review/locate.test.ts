import { describe, expect, it } from "vitest";
import type { PreparedFile } from "@/lib/review/prepare";
import type { Step } from "@/lib/types";
import { addedHunk, fileDiff } from "@/test/diff-builders";
import { isInTarget, isSameLine, nextOpenStep, stepForLine } from "./locate";

describe("isInTarget", () => {
  it("matches every line from the target's line through its endLine", () => {
    const target = { path: "src/a.ts", line: 4, endLine: 6 };
    expect(isInTarget(target, "src/a.ts", 3)).toBe(false);
    expect(isInTarget(target, "src/a.ts", 4)).toBe(true);
    expect(isInTarget(target, "src/a.ts", 5)).toBe(true);
    expect(isInTarget(target, "src/a.ts", 6)).toBe(true);
    expect(isInTarget(target, "src/a.ts", 7)).toBe(false);
  });

  it("matches only the target's line when there is no endLine", () => {
    const target = { path: "src/a.ts", line: 4 };
    expect(isInTarget(target, "src/a.ts", 4)).toBe(true);
    expect(isInTarget(target, "src/a.ts", 5)).toBe(false);
  });

  it("never matches another path or a missing target", () => {
    expect(isInTarget({ path: "src/a.ts", line: 4, endLine: 6 }, "src/b.ts", 5)).toBe(false);
    expect(isInTarget(null, "src/a.ts", 5)).toBe(false);
  });
});

describe("isSameLine", () => {
  it("matches a target on the same path and line, ignoring the symbol name", () => {
    const target = { path: "src/a.ts", line: 4, name: "total" };
    expect(isSameLine(target, "src/a.ts", 4)).toBe(true);
    expect(isSameLine(target, "src/a.ts", 5)).toBe(false);
    expect(isSameLine(target, "src/b.ts", 4)).toBe(false);
    expect(isSameLine(null, "src/a.ts", 4)).toBe(false);
  });
});

const FILE: PreparedFile = {
  ...fileDiff("a.ts", [addedHunk(["a", "b"], 1), addedHunk(["c"], 50)]),
  highlighted: [],
  navigable: true,
};

function step(id: string, hunkIndexes: number[]): Step {
  return {
    id,
    title: id,
    role: "core",
    reason: "",
    changedLines: 1,
    files: [{ path: "a.ts", hunkIndexes }],
  };
}

const STEPS = [step("s1", [0]), step("s2", [1]), step("s3", [])];

describe("stepForLine", () => {
  it("finds the step holding the hunk with that line", () => {
    expect(stepForLine(STEPS, [FILE], { path: "a.ts", line: 50 })?.id).toBe("s2");
  });

  it("falls back to the first step with the file, or nothing", () => {
    expect(stepForLine(STEPS, [FILE], { path: "a.ts", line: 999 })?.id).toBe("s1");
    expect(stepForLine(STEPS, [FILE], { path: "other.ts", line: 1 })).toBeNull();
  });
});

describe("nextOpenStep", () => {
  it("finds the next unfinished step, wrapping around", () => {
    expect(nextOpenStep(STEPS, ["s2"], "s1")?.id).toBe("s3");
    expect(nextOpenStep(STEPS, ["s3"], "s2")?.id).toBe("s1");
    expect(nextOpenStep(STEPS, ["s1", "s2", "s3"], "s1")).toBeNull();
    expect(nextOpenStep(STEPS, [], null)?.id).toBe("s1");
  });
});
