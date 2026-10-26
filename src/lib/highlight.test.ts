import { describe, expect, it } from "vitest";
import { addedHunk, fileDiff } from "@/test/diff-builders";
import { highlightFile } from "./highlight";

describe("highlightFile", () => {
  it("returns coloured tokens per hunk line in both themes", async () => {
    const [hunk] = await highlightFile(
      fileDiff("a.ts", [addedHunk(["const a = 1;", "return a;"])]),
    );
    expect(hunk).toHaveLength(2);
    expect(hunk[0].map((token) => token.text).join("")).toBe("const a = 1;");
    expect(hunk[0][0]).toMatchObject({ light: expect.any(String), dark: expect.any(String) });
  });

  it("falls back to plain text for unknown languages", async () => {
    const [hunk] = await highlightFile(fileDiff("notes.xyz", [addedHunk(["hello"])]));
    expect(hunk).toEqual([[{ text: "hello" }]]);
  });
});
