import { describe, expect, it } from "vitest";
import { groupReferencesByFile } from "./reference-groups";

const reference = (path: string, line: number) => ({ path, line, text: "x", tokens: [] });

describe("groupReferencesByFile", () => {
  it("groups references by file, pull request files first, in first-seen order", () => {
    const groups = groupReferencesByFile(
      [reference("b.ts", 1), reference("a.ts", 9), reference("b.ts", 4), reference("c.ts", 2)],
      (path) => path === "c.ts",
    );
    expect(
      groups.map((group) => [group.path, group.inPullRequest, group.references.length]),
    ).toEqual([
      ["c.ts", true, 1],
      ["b.ts", false, 2],
      ["a.ts", false, 1],
    ]);
  });
});
