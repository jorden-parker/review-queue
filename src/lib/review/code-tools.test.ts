import fs from "node:fs";
import path from "node:path";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { ZodError } from "zod";
import { ensureCheckout } from "@/lib/git/checkout";
import { type Reference, SymbolIndex } from "@/lib/symbols/symbol-index";
import {
  createFixtureRepo,
  type FixtureRepo,
  headOf,
  mainOf,
  removeFixtureRepo,
} from "@/test/git-fixture";
import { codeTools, type CodeLookupIndex } from "./code-tools";

const REF = { owner: "acme", repo: "app", number: 1 };

const LONG_FILE = Array.from({ length: 200 }, (_, line) => `export const line${line} = ${line};`);

const WIDE_FILE = Array.from({ length: 150 }, () => "x".repeat(100));

function fakeIndex(overrides: Partial<CodeLookupIndex>): CodeLookupIndex {
  return {
    listFiles: async () => [],
    definitionsOf: () => [],
    referencesTo: async () => [],
    search: async () => [],
    readLines: () => [],
    ...overrides,
  };
}

function uses(count: number): Reference[] {
  return Array.from({ length: count }, (_, index) => ({
    path: "src/many.ts",
    line: index + 1,
    text: "helper();",
  }));
}

describe("codeTools", () => {
  let fixture: FixtureRepo;
  let worktree: string;
  let index: SymbolIndex;

  beforeAll(async () => {
    fixture = createFixtureRepo(
      { "README.md": "start\n" },
      {
        "README.md": "TODO: write docs\n",
        "src/util.ts": "export function helper(a: number) {\n  return a + 1;\n}\n",
        "src/app.ts": "import { helper } from './util';\nexport const run = () => helper(1);\n",
        "src/long.ts": `${LONG_FILE.join("\n")}\n`,
        "src/wide.ts": `${WIDE_FILE.join("\n")}\n`,
      },
      REF.number,
    );
    const checkout = await ensureCheckout(
      REF,
      { baseBranch: "main", baseSha: mainOf(fixture), headSha: headOf(fixture, REF.number) },
      { cacheRoot: fixture.cacheRoot, remoteUrl: fixture.origin },
    );
    worktree = checkout.worktreePath;
    index = await SymbolIndex.build(worktree, checkout.run);
  });

  afterAll(() => removeFixtureRepo(fixture));

  const run = (name: string, input: unknown) => codeTools(index, "src/app.ts").run(name, input);

  describe("find_definition", () => {
    it("shows the definition's span and numbered body, and records a lookup", async () => {
      const outcome = await run("find_definition", { name: "helper" });
      expect(outcome.content).toContain("src/util.ts:1-3");
      expect(outcome.content).toContain("1: export function helper(a: number) {");
      expect(outcome.lookup).toEqual({
        tool: "find_definition",
        label: "Definition of `helper` (1)",
        paths: ["src/util.ts"],
      });
    });

    it("says so when nothing defines the name", async () => {
      const outcome = await run("find_definition", { name: "nothingDefinesThis" });
      expect(outcome.content).toContain("No definition of `nothingDefinesThis` found.");
      expect(outcome.lookup.paths).toEqual([]);
    });
  });

  describe("find_references", () => {
    it("lists each use as path:line and records a lookup", async () => {
      const outcome = await run("find_references", { name: "helper" });
      expect(outcome.content).toContain("src/app.ts:2: export const run = () => helper(1);");
      expect(outcome.lookup).toEqual({
        tool: "find_references",
        label: "Callers and uses of `helper` (3)",
        paths: ["src/app.ts", "src/util.ts"],
      });
    });
  });

  describe("search_code", () => {
    it("lists matching lines and records a lookup", async () => {
      const outcome = await run("search_code", { query: "TODO" });
      expect(outcome.content).toContain("README.md:1: TODO: write docs");
      expect(outcome.lookup).toEqual({
        tool: "search_code",
        label: "Search for `TODO` (1)",
        paths: ["README.md"],
      });
    });
  });

  describe("read_file", () => {
    it("returns numbered lines of a tracked file", async () => {
      const outcome = await run("read_file", { path: "src/util.ts", start_line: 1, end_line: 2 });
      expect(outcome.content).toContain("1: export function helper(a: number) {");
      expect(outcome.content).toContain("2:   return a + 1;");
      expect(outcome.lookup).toEqual({
        tool: "read_file",
        label: "Read `src/util.ts` L1–L2",
        paths: ["src/util.ts"],
      });
    });

    it("clamps a read to 150 lines", async () => {
      const outcome = await run("read_file", { path: "src/long.ts", start_line: 1, end_line: 200 });
      expect(outcome.content).toContain("150: export const line149 = 149;");
      expect(outcome.content).not.toContain("151: ");
      expect(outcome.lookup.label).toBe("Read `src/long.ts` L1–L150");
    });

    it("refuses paths that are not tracked files of the checkout", async () => {
      fs.writeFileSync(path.join(worktree, "untracked.txt"), "not committed\n");
      await expect(
        run("read_file", { path: "../etc/passwd", start_line: 1, end_line: 2 }),
      ).rejects.toThrow("Not a tracked file: ../etc/passwd");
      await expect(
        run("read_file", { path: ".git/config", start_line: 1, end_line: 2 }),
      ).rejects.toThrow("Not a tracked file: .git/config");
      await expect(
        run("read_file", { path: "untracked.txt", start_line: 1, end_line: 1 }),
      ).rejects.toThrow("Not a tracked file: untracked.txt");
    });

    it("truncates a result that is over the cap, inside the fence", async () => {
      const outcome = await run("read_file", { path: "src/wide.ts", start_line: 1, end_line: 150 });
      expect(outcome.content.length).toBeLessThanOrEqual(6_000);
      expect(outcome.content.endsWith("\n… (truncated)\n</pr_tool_result>")).toBe(true);
    });
  });

  describe("tracked file listing", () => {
    afterEach(() => vi.restoreAllMocks());

    it("retries the listing after it fails", async () => {
      vi.spyOn(index, "listFiles").mockRejectedValueOnce(new Error("ls-files failed"));
      const tools = codeTools(index, "src/app.ts");
      const readUtil = () =>
        tools.run("read_file", { path: "src/util.ts", start_line: 1, end_line: 1 });
      await expect(readUtil()).rejects.toThrow("ls-files failed");
      await expect(readUtil()).resolves.toMatchObject({
        content: expect.stringContaining("1: export function helper"),
      });
    });
  });

  describe("input and output contract", () => {
    it("rejects input that does not match the schema without calling git", async () => {
      await expect(run("find_references", {})).rejects.toBeInstanceOf(ZodError);
      await expect(run("find_references", { invalid_json: '{"name":' })).rejects.toBeInstanceOf(
        ZodError,
      );
      await expect(run("read_file", { invalid_json: '{"path":' })).rejects.toBeInstanceOf(ZodError);
      await expect(run("find_references", { name: "x".repeat(500) })).rejects.toBeInstanceOf(
        ZodError,
      );
      await expect(
        run("read_file", { path: "src/util.ts", start_line: 0, end_line: 2 }),
      ).rejects.toBeInstanceOf(ZodError);
    });

    it("fences every result as data", async () => {
      const outcomes = await Promise.all([
        run("find_definition", { name: "helper" }),
        run("find_references", { name: "helper" }),
        run("search_code", { query: "TODO" }),
        run("read_file", { path: "src/util.ts", start_line: 1, end_line: 1 }),
      ]);
      for (const outcome of outcomes) {
        expect(outcome.content.startsWith("<pr_tool_result>\n")).toBe(true);
        expect(outcome.content.endsWith("\n</pr_tool_result>")).toBe(true);
      }
    });

    it("rejects a tool name it does not know", async () => {
      await expect(run("delete_everything", {})).rejects.toThrow("Unknown tool: delete_everything");
    });
  });

  describe("lookup limits", () => {
    it("keeps an exact count up to the limit", async () => {
      const lookup = codeTools(fakeIndex({ referencesTo: async () => uses(40) }), "src/app.ts");
      const outcome = await lookup.run("find_references", { name: "helper" });
      expect(outcome.lookup.label).toBe("Callers and uses of `helper` (40)");
    });

    it("marks a reference lookup over the limit as open-ended and shows only the limit", async () => {
      const lookup = codeTools(fakeIndex({ referencesTo: async () => uses(41) }), "src/app.ts");
      const outcome = await lookup.run("find_references", { name: "helper" });
      expect(outcome.lookup.label).toBe("Callers and uses of `helper` (40+)");
      expect(outcome.content.match(/src\/many\.ts:\d+:/g)).toHaveLength(40);
    });

    it("marks a search over the limit as open-ended", async () => {
      const lookup = codeTools(fakeIndex({ search: async () => uses(41) }), "src/app.ts");
      const outcome = await lookup.run("search_code", { query: "helper" });
      expect(outcome.lookup.label).toBe("Search for `helper` (40+)");
    });

    it("marks a definition list longer than it shows as open-ended", async () => {
      const definitions = Array.from({ length: 4 }, (_, index) => ({
        name: "helper",
        kind: "function" as const,
        path: `src/d${index}.ts`,
        line: 1,
        endLine: 1,
      }));
      const lookup = codeTools(fakeIndex({ definitionsOf: () => definitions }), "src/app.ts");
      const outcome = await lookup.run("find_definition", { name: "helper" });
      expect(outcome.lookup.label).toBe("Definition of `helper` (3+)");
    });
  });
});
