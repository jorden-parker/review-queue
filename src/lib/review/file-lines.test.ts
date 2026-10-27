import { describe, expect, it } from "vitest";
import { MAX_FILE_BYTES } from "@/lib/symbols/symbol-index";
import { fileLines } from "./file-lines";

const reader = (text: string) => ({ readFile: () => text });

describe("fileLines", () => {
  it("highlights every line of the file", async () => {
    const result = await fileLines(reader("const a = 1;\nconst b = 2;\n"), "src/a.ts");
    expect(result?.tokens.map((row) => row.map((token) => token.text).join(""))).toEqual([
      "const a = 1;",
      "const b = 2;",
    ]);
    expect(result?.truncated).toBe(false);
  });

  it("flags a file cut at the read limit", async () => {
    const result = await fileLines(reader("x".repeat(MAX_FILE_BYTES)), "notes.txt");
    expect(result?.truncated).toBe(true);
  });

  it("returns null when the file cannot be read", async () => {
    const failing = {
      readFile: () => {
        throw new Error("Path outside checkout");
      },
    };
    expect(await fileLines(failing, "../secret")).toBeNull();
  });
});
