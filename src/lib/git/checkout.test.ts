import fs from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  createFixtureRepo,
  mainOf,
  removeFixtureRepo,
  squashMergeFeature,
  type FixtureRepo,
} from "@/test/git-fixture";
import { diffCheckout, ensureCheckout, fileChurn } from "./checkout";

const REF = { owner: "acme", repo: "app", number: 3 };

function currentBase(fixture: FixtureRepo) {
  return { branch: "main", sha: mainOf(fixture) };
}

describe("checkout", () => {
  let fixture: FixtureRepo;

  beforeEach(() => {
    fixture = createFixtureRepo(
      { "src/a.ts": "export const a = 1;\n", "README.md": "hi\n" },
      { "src/a.ts": "export const a = 2;\n", "src/b.ts": "export const b = 1;\n" },
      REF.number,
    );
  });

  afterEach(() => removeFixtureRepo(fixture));

  it("checks out the PR head into a worktree and diffs it against the merge base", async () => {
    const options = { cacheRoot: fixture.cacheRoot, remoteUrl: fixture.origin };
    const checkout = await ensureCheckout(REF, currentBase(fixture), options);
    expect(fs.readFileSync(path.join(checkout.worktreePath, "src/b.ts"), "utf8")).toContain(
      "b = 1",
    );
    expect(checkout.headSha).toMatch(/^[0-9a-f]{40}$/);

    const again = await ensureCheckout(REF, currentBase(fixture), options);
    expect(again.worktreePath).toBe(checkout.worktreePath);

    const diffs = await diffCheckout(checkout);
    expect(diffs.map((diff) => [diff.path, diff.status])).toEqual([
      ["src/a.ts", "modified"],
      ["src/b.ts", "added"],
    ]);
  });

  it("diffs a merged PR against the base it was opened on, not today's base", async () => {
    const openedOn = mainOf(fixture);
    squashMergeFeature(fixture, {
      "src/a.ts": "export const a = 2;\n",
      "src/b.ts": "export const b = 1;\n",
    });
    const checkout = await ensureCheckout(
      REF,
      { branch: "main", sha: openedOn },
      { cacheRoot: fixture.cacheRoot, remoteUrl: fixture.origin },
    );
    const diffs = await diffCheckout(checkout);
    expect(diffs.map((diff) => diff.path)).toEqual(["src/a.ts", "src/b.ts"]);
  });

  it("never parses a from-revision as a git option", async () => {
    const options = { cacheRoot: fixture.cacheRoot, remoteUrl: fixture.origin };
    const checkout = await ensureCheckout(REF, currentBase(fixture), options);
    const target = path.join(fixture.cacheRoot, "written-by-git");
    await expect(diffCheckout(checkout, `--output=${target}`)).rejects.toThrow();
    expect(fs.existsSync(target)).toBe(false);
  });

  it("counts how often files changed in history", async () => {
    const checkout = await ensureCheckout(REF, currentBase(fixture), {
      cacheRoot: fixture.cacheRoot,
      remoteUrl: fixture.origin,
    });
    const churn = await fileChurn(checkout);
    expect(churn.get("src/a.ts")).toBe(2);
    expect(churn.get("README.md")).toBe(1);
  });
});
