import { describe, expect, it } from "vitest";
import type { SymbolDefinition } from "@/lib/types";
import { definitionsWithCode, referencesWithCode, type PeekIndex } from "./peek-code";

const definition: SymbolDefinition = {
  name: "retry",
  kind: "function",
  path: "src/retry.ts",
  line: 3,
  endLine: 90,
};

function stubIndex(): PeekIndex & { reads: number[][] } {
  const reads: number[][] = [];
  return {
    reads,
    definitionsOf: () => [definition],
    readLines: (_file, start, end) => {
      reads.push([start, end]);
      return ["function retry() {", "}"];
    },
    referencesTo: async () => [
      { path: "src/a.ts", line: 4, text: "  retry();" },
      { path: "notes.xyz", line: 1, text: "retry" },
    ],
  };
}

describe("definitionsWithCode", () => {
  it("returns a capped snippet with highlighted tokens", async () => {
    const index = stubIndex();
    const [result] = await definitionsWithCode(index, "retry", "src/a.ts");
    expect(index.reads).toEqual([[3, 42]]);
    expect(result.lines).toEqual(["function retry() {", "}"]);
    expect(result.tokens).toHaveLength(2);
    expect(result.tokens[0][0]).toMatchObject({ light: expect.any(String) });
  });
});

describe("referencesWithCode", () => {
  it("highlights each trimmed reference line by its own file's language", async () => {
    const [typed, plain] = await referencesWithCode(stubIndex(), "retry");
    expect(typed.tokens.map((token) => token.text).join("")).toBe("retry();");
    expect(typed.tokens[0]).toMatchObject({ light: expect.any(String) });
    expect(plain.tokens).toEqual([{ text: "retry" }]);
  });
});
