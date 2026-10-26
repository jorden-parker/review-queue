import { describe, expect, it } from "vitest";
import { addedHunk, fileDiff } from "@/test/diff-builders";
import { highlightFile, highlightLines } from "./highlight";

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

describe("highlightLines", () => {
  it("colours lines by the file's language", async () => {
    const [line] = await highlightLines("src/a.ts", ["const a = 1;"]);
    expect(line.map((token) => token.text).join("")).toBe("const a = 1;");
    expect(line[0]).toMatchObject({ light: expect.any(String), dark: expect.any(String) });
  });

  it("marks string and comment text as literal but not code inside template interpolation", async () => {
    const [importLine, templateLine, commentLine] = await highlightLines("src/a.ts", [
      'import { format } from "./format";',
      "const label = `${format(ms)} ms`;",
      "// format is handy",
    ]);
    const literalText = (line: typeof importLine) =>
      line
        .filter((token) => token.literal)
        .map((token) => token.text)
        .join("");
    expect(literalText(importLine).trim()).toBe('"./format"');
    expect(literalText(templateLine)).not.toContain("format");
    expect(literalText(templateLine)).toContain(" ms");
    expect(literalText(commentLine)).toBe("// format is handy");
  });

  it("keeps unknown languages as plain text", async () => {
    expect(await highlightLines("notes.xyz", ["hello"])).toEqual([[{ text: "hello" }]]);
  });
});
