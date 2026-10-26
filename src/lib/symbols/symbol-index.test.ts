import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { Runner } from "@/lib/exec";
import { ensureCheckout } from "@/lib/git/checkout";
import { createFixtureRepo, mainOf, removeFixtureRepo, type FixtureRepo } from "@/test/git-fixture";
import { SymbolIndex } from "./symbol-index";

const REF = { owner: "acme", repo: "app", number: 1 };

describe("SymbolIndex", () => {
  let fixture: FixtureRepo;
  let index: SymbolIndex;

  beforeEach(async () => {
    fixture = createFixtureRepo(
      {
        "src/store.ts": "export function load(id: string) {\n  return id;\n}\n",
        "lib/other/store.ts": "export function load() {}\n",
        "node_modules/x/index.js": "function load() {}\n",
      },
      { "src/app.ts": "import { load } from './store';\nexport const run = () => load('1');\n" },
      REF.number,
    );
    const checkout = await ensureCheckout(
      REF,
      { branch: "main", sha: mainOf(fixture) },
      {
        cacheRoot: fixture.cacheRoot,
        remoteUrl: fixture.origin,
      },
    );
    index = await SymbolIndex.build(checkout.worktreePath, checkout.run);
  });

  afterEach(() => removeFixtureRepo(fixture));

  it("ranks definitions nearest to the file you are reading first", () => {
    const paths = index.definitionsOf("load", "src/app.ts").map((definition) => definition.path);
    expect(paths).toEqual(["src/store.ts", "lib/other/store.ts"]);
  });

  it("knows every defined name", () => {
    expect(index.hasName("run")).toBe(true);
    expect(index.hasName("nope")).toBe(false);
  });

  it("lists definitions in a file", () => {
    expect(index.definitionsIn("src/app.ts").map((definition) => definition.name)).toEqual(["run"]);
  });

  it("finds references with git grep", async () => {
    const references = await index.referencesTo("load");
    expect(references.map((reference) => `${reference.path}:${reference.line}`)).toEqual([
      "lib/other/store.ts:1",
      "src/app.ts:1",
      "src/app.ts:2",
      "src/store.ts:1",
    ]);
    expect(references[2].text).toContain("load('1')");
  });

  it("reads a snippet and refuses paths outside the checkout", () => {
    expect(index.readLines("src/store.ts", 1, 2)).toEqual([
      "export function load(id: string) {",
      "  return id;",
    ]);
    expect(() => index.readLines("../../etc/passwd", 1, 1)).toThrow();
  });
});

describe("SymbolIndex with hostile checkouts", () => {
  let sandbox: string;
  let root: string;

  function runnerListing(listing: string, grepOutput = ""): Runner {
    return async (_command, args) => (args[0] === "ls-files" ? listing : grepOutput);
  }

  beforeEach(() => {
    sandbox = fs.mkdtempSync(path.join(os.tmpdir(), "symbol-index-"));
    root = path.join(sandbox, "checkout");
    fs.mkdirSync(root);
    fs.writeFileSync(path.join(sandbox, "secret.ts"), "export function secretThing() {}\n");
    fs.writeFileSync(path.join(root, "ok.ts"), "export function fine() {}\n");
    fs.symlinkSync(path.join(sandbox, "secret.ts"), path.join(root, "link.ts"));
    fs.symlinkSync("loop.ts", path.join(root, "loop.ts"));
  });

  afterEach(() => fs.rmSync(sandbox, { recursive: true, force: true }));

  it("skips symlinks instead of following or failing on them", async () => {
    const index = await SymbolIndex.build(root, runnerListing("ok.ts\nlink.ts\nloop.ts\n"));
    expect(index.hasName("fine")).toBe(true);
    expect(index.hasName("secretThing")).toBe(false);
  });

  it("refuses to read a snippet through a symlink that leaves the checkout", async () => {
    const index = await SymbolIndex.build(root, runnerListing("ok.ts\n"));
    expect(() => index.readLines("link.ts", 1, 1)).toThrow();
  });

  it("parses grep lines whose text ends in a carriage return", async () => {
    const index = await SymbolIndex.build(root, runnerListing("", "src/a.ts:3:fine():1:2\r\n"));
    expect(await index.referencesTo("fine")).toEqual([
      { path: "src/a.ts", line: 3, text: "fine():1:2\r" },
    ]);
  });
});
