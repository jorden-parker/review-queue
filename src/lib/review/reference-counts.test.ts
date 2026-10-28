import { describe, expect, it, vi } from "vitest";
import type { LanguageClient, ServerLocation } from "@/lib/lsp/client";
import type { SymbolDefinition } from "@/lib/types";
import { addedHunk, fileDiff } from "@/test/diff-builders";
import { lensDeclarations, referenceCountsIn, type CountSource } from "./reference-counts";

const PATH = "src/store.ts";
const FILE = fileDiff(PATH, [
  addedHunk(["export class Store {", "  load(id: string) {}", "  $cache = 1;", "}"], 10),
]);
const PREPARED_FILE = { ...FILE, highlighted: [], navigable: true };

function definition(name: string, kind: SymbolDefinition["kind"], line: number) {
  return { name, kind, path: PATH, line, endLine: line };
}

const DEFINITIONS: SymbolDefinition[] = [
  definition("Store", "class", 10),
  definition("load", "method", 11),
  definition("id", "parameter", 11),
  definition("$cache", "property", 12),
  definition("outside", "function", 40),
];

function location(line: number): ServerLocation {
  return { file: `/checkout/${PATH}`, line, character: 0, endLine: line, declarationLine: line };
}

function source(client: Partial<LanguageClient> | null, grepHits = 3): CountSource {
  return {
    index: {
      definitionsIn: () => DEFINITIONS,
      referencesTo: vi.fn(async () =>
        Array.from({ length: grepHits }, () => ({ path: PATH, line: 1, text: "" })),
      ),
      relativePath: (absolute) =>
        absolute.startsWith("/checkout/") ? absolute.slice("/checkout/".length) : null,
    },
    clientFor: async () => client as LanguageClient | null,
  };
}

describe("lensDeclarations", () => {
  it("keeps declarations on new-side diff lines with the name's column", () => {
    expect(lensDeclarations(FILE, DEFINITIONS)).toEqual([
      { name: "Store", line: 10, character: 13 },
      { name: "load", line: 11, character: 2 },
      { name: "$cache", line: 12, character: 2 },
    ]);
  });

  it("matches the name as a whole word", () => {
    const file = fileDiff(PATH, [addedHunk(["const reload = load;"], 1)]);
    expect(lensDeclarations(file, [definition("load", "variable", 1)])).toEqual([
      { name: "load", line: 1, character: 15 },
    ]);
  });

  it("skips deleted lines", () => {
    const file = fileDiff(PATH, [
      {
        header: "",
        oldStart: 1,
        newStart: 1,
        lines: [{ kind: "del", text: "function gone() {}", oldLine: 1, newLine: null }],
      },
    ]);
    expect(lensDeclarations(file, [definition("gone", "function", 1)])).toEqual([]);
  });
});

describe("referenceCountsIn", () => {
  it("counts the language server's references at each declaration", async () => {
    const references = vi.fn(async (_file: string, line: number) =>
      line === 11 ? [location(30), location(31)] : [location(5)],
    );
    const counts = await referenceCountsIn(source({ references }), PREPARED_FILE);
    expect(counts).toEqual([
      { name: "Store", line: 10, character: 13, count: 1 },
      { name: "load", line: 11, character: 2, count: 2 },
      { name: "$cache", line: 12, character: 2, count: 1 },
    ]);
    expect(references).toHaveBeenCalledWith(PATH, 11, 2);
  });

  it("falls back to textual matches minus the declaration without a server", async () => {
    const counts = await referenceCountsIn(source(null, 4), PREPARED_FILE);
    expect(counts.map((count) => count.count)).toEqual([3, 3, 3]);
  });

  it("counts only references inside the checkout", async () => {
    const library = { ...location(9), file: "/opt/ts/lib/lib.dom.d.ts" };
    const references = vi.fn(async () => [location(5), library]);
    const counts = await referenceCountsIn(source({ references }), PREPARED_FILE);
    expect(counts.map((count) => count.count)).toEqual([1, 1, 1]);
  });

  it("falls back when the server fails and trusts it when it finds nothing", async () => {
    const references = vi.fn().mockRejectedValueOnce(new Error("timeout")).mockResolvedValue([]);
    const counts = await referenceCountsIn(source({ references }, 2), PREPARED_FILE);
    expect(counts.map((count) => count.count)).toEqual([1, 0, 0]);
  });

  it("computes each file's counts once per review", async () => {
    const review = source(null);
    await referenceCountsIn(review, PREPARED_FILE);
    await referenceCountsIn(review, PREPARED_FILE);
    expect(review.index.referencesTo).toHaveBeenCalledTimes(3);
  });

  it("recomputes a file whose counts failed", async () => {
    const counting = source(null);
    vi.mocked(counting.index.referencesTo).mockRejectedValueOnce(new Error("grep failed"));
    await expect(referenceCountsIn(counting, PREPARED_FILE)).rejects.toThrow("grep failed");
    await expect(referenceCountsIn(counting, PREPARED_FILE)).resolves.toHaveLength(3);
  });

  it("counts the declarations of a file concurrently, in declaration order", async () => {
    let active = 0;
    let peak = 0;
    const review = source(null);
    review.index.referencesTo = async () => {
      active += 1;
      peak = Math.max(peak, active);
      await new Promise((resolve) => setTimeout(resolve, 5));
      active -= 1;
      return [{ path: PATH, line: 1, text: "" }];
    };
    const counts = await referenceCountsIn(review, PREPARED_FILE);
    expect(counts.map((count) => count.name)).toEqual(["Store", "load", "$cache"]);
    expect(peak).toBe(3);
  });

  it("marks a textual count that reached the reference limit as capped", async () => {
    const counts = await referenceCountsIn(source(null, 60), PREPARED_FILE);
    expect(counts.map((count) => [count.count, count.capped])).toEqual([
      [59, true],
      [59, true],
      [59, true],
    ]);
  });
});
