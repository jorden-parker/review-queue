import { describe, expect, it } from "vitest";
import type { PreparedFile } from "@/lib/review/prepare";
import { addedHunk, fileDiff } from "@/test/diff-builders";
import { citationsInText, parseCitation } from "./citations";

function preparedFile(path: string, newStart: number, count: number): PreparedFile {
  return {
    ...fileDiff(path, [
      addedHunk(
        Array.from({ length: count }, () => "x"),
        newStart,
      ),
    ]),
    highlighted: [],
    navigable: true,
  };
}

const FILES = [preparedFile("src/a.ts", 10, 3), preparedFile("src/lib/c.ts", 1, 1)];
const KNOWN = FILES.map((file) => file.path);
const DEFAULT = "src/a.ts";

function cite(code: string, knownPaths = KNOWN, defaultPath = DEFAULT) {
  return parseCitation(code, knownPaths, defaultPath, FILES);
}

describe("parseCitation accepted forms", () => {
  it("reads path:LINE", () => {
    expect(cite("src/a.ts:11")).toEqual({
      code: "src/a.ts:11",
      path: "src/a.ts",
      line: 11,
      endLine: 11,
      inDiff: true,
    });
  });

  it("reads path:START-END", () => {
    expect(cite("src/a.ts:10-12")).toEqual({
      code: "src/a.ts:10-12",
      path: "src/a.ts",
      line: 10,
      endLine: 12,
      inDiff: true,
    });
  });

  it("reads path#LLINE and path#LSTART-LEND", () => {
    expect(cite("src/a.ts#L10")?.line).toBe(10);
    expect(cite("src/a.ts#L10-L12")?.endLine).toBe(12);
  });

  it("uses the default path for bare line forms", () => {
    expect(cite("L10")).toEqual({
      code: "L10",
      path: "src/a.ts",
      line: 10,
      endLine: 10,
      inDiff: true,
    });
    expect(cite("L10-12")?.endLine).toBe(12);
    expect(cite("L10-L12")?.endLine).toBe(12);
  });

  it("ignores surrounding whitespace", () => {
    expect(cite("  src/a.ts:10  ")?.line).toBe(10);
  });

  it("resolves a unique suffix on a slash boundary", () => {
    expect(cite("c.ts:1", KNOWN)?.path).toBe("src/lib/c.ts");
  });

  it("does not match a suffix that is only part of a file name", () => {
    expect(cite("a.ts:10", ["src/xa.ts"], "src/xa.ts")).toBeNull();
  });
});

describe("parseCitation rejections", () => {
  it("returns null for an unknown path", () => {
    expect(cite("nope.ts:10")).toBeNull();
  });

  it("returns null for an ambiguous suffix", () => {
    expect(cite("a.ts:10", ["src/a.ts", "test/a.ts"])).toBeNull();
  });

  it("returns null for code that is not a citation", () => {
    expect(cite("const x = 1")).toBeNull();
  });

  it("returns null for line 0", () => {
    expect(cite("src/a.ts:0")).toBeNull();
  });

  it("returns null for a bare line when the default path is unknown", () => {
    expect(cite("L10", KNOWN, "missing.ts")).toBeNull();
  });
});

describe("parseCitation ranges", () => {
  it("swaps a reversed range", () => {
    expect(cite("src/a.ts:12-10")).toMatchObject({ line: 10, endLine: 12 });
  });

  it("clamps a range longer than 200 lines to 200 more than its start", () => {
    expect(cite("src/a.ts:1-500")).toMatchObject({ line: 1, endLine: 201 });
  });

  it("reports inDiff false for a line outside every hunk", () => {
    expect(cite("src/a.ts:50")?.inDiff).toBe(false);
  });
});

describe("citationsInText", () => {
  const parse = (code: string) => cite(code);

  it("lists the citations in the order they appear", () => {
    const text = "See `src/a.ts:11` then `src/a.ts:10-12`.";
    expect(citationsInText(text, parse).map((citation) => citation.code)).toEqual([
      "src/a.ts:11",
      "src/a.ts:10-12",
    ]);
  });

  it("skips inline code that is not a citation", () => {
    const text = "Call `loadReview` and `src/a.ts:11`.";
    expect(citationsInText(text, parse).map((citation) => citation.code)).toEqual(["src/a.ts:11"]);
  });

  it("ignores code inside fenced blocks", () => {
    const text = "```ts\nconst x = `src/a.ts:11`;\n```";
    expect(citationsInText(text, parse)).toEqual([]);
  });

  it("keeps only the first occurrence of a repeated citation", () => {
    const text = "`src/a.ts:11` and again `src/a.ts:11`";
    expect(citationsInText(text, parse)).toHaveLength(1);
  });
});
