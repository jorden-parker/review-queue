import { describe, expect, it } from "vitest";
import type { SymbolDefinition } from "@/lib/types";
import { addedHunk, fileDiff, lines } from "@/test/diff-builders";
import { buildReadingPath, estimateMinutes } from "./reading-path";

function lookup(definitions: Record<string, string[]>) {
  return {
    definitionsIn: (file: string): SymbolDefinition[] =>
      (definitions[file] ?? []).map((name) => ({
        name,
        kind: "function",
        path: file,
        line: 1,
        endLine: 1,
      })),
  };
}

describe("buildReadingPath", () => {
  it("orders by role and puts generated files last", () => {
    const { steps, startStepId } = buildReadingPath(
      [
        fileDiff("pnpm-lock.yaml", [addedHunk(lines(5))]),
        fileDiff("src/cache.test.ts", [addedHunk(lines(5))]),
        fileDiff("src/app/page.tsx", [addedHunk(lines(5))]),
        fileDiff("src/cache.ts", [addedHunk(lines(5))]),
        fileDiff("src/types.ts", [addedHunk(lines(5))]),
      ],
      lookup({}),
    );
    expect(steps.map((step) => step.role)).toEqual([
      "types",
      "core",
      "caller",
      "test",
      "generated",
    ]);
    expect(startStepId).toBe(steps[0].id);
  });

  it("puts a file before the files that use what it defines", () => {
    const { steps } = buildReadingPath(
      [
        fileDiff("src/service/a-service.ts", [addedHunk(["const x = loadUser(id);"])]),
        fileDiff("src/users/z-users.ts", [addedHunk(["export function loadUser() {}"])]),
      ],
      lookup({ "src/users/z-users.ts": ["loadUser"], "src/service/a-service.ts": ["x"] }),
    );
    expect(steps.map((step) => step.files[0].path)).toEqual([
      "src/users/z-users.ts",
      "src/service/a-service.ts",
    ]);
    expect(steps[0].reason).toContain("a-service.ts");
  });

  it("splits a big file into steps of whole hunks", () => {
    const { steps } = buildReadingPath(
      [
        fileDiff("src/big.ts", [
          addedHunk(lines(100), 1),
          addedHunk(lines(100), 200),
          addedHunk(lines(20), 400),
        ]),
      ],
      lookup({}),
    );
    expect(steps.map((step) => step.files[0].hunkIndexes)).toEqual([[0], [1, 2]]);
    expect(steps.map((step) => step.title)).toEqual([
      "big.ts (part 1 of 2)",
      "big.ts (part 2 of 2)",
    ]);
  });

  it("groups small files in the same folder and role", () => {
    const { steps } = buildReadingPath(
      [
        fileDiff("docs/a.md", [addedHunk(lines(3))]),
        fileDiff("docs/b.md", [addedHunk(lines(3))]),
        fileDiff("README.md", [addedHunk(lines(3))]),
      ],
      lookup({}),
    );
    expect(steps.map((step) => step.files.map((file) => file.path))).toEqual([
      ["docs/a.md", "docs/b.md"],
      ["README.md"],
    ]);
    expect(steps[0].title).toBe("docs/ (2 files)");
  });

  it("keeps step ids stable for the same diff", () => {
    const diffs = [fileDiff("src/cache.ts", [addedHunk(lines(5))])];
    expect(buildReadingPath(diffs, lookup({})).steps[0].id).toBe(
      buildReadingPath(diffs, lookup({})).steps[0].id,
    );
  });

  it("estimates minutes from changed lines", () => {
    expect(estimateMinutes(0)).toBe(1);
    expect(estimateMinutes(300)).toBe(20);
  });
});
