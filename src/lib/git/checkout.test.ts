import fs from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { runCommand, type Runner } from "@/lib/exec";
import {
  createFixtureRepo,
  headOf,
  mainOf,
  pushFeatureCommit,
  removeFixtureRepo,
  squashMergeFeature,
  type FixtureRepo,
} from "@/test/git-fixture";
import { diffCheckout, ensureCheckout, fileChurn } from "./checkout";

const REF = { owner: "acme", repo: "app", number: 3 };

function currentCommits(fixture: FixtureRepo) {
  return { baseBranch: "main", baseSha: mainOf(fixture), headSha: headOf(fixture, REF.number) };
}

function recordingRunner() {
  const commands: string[] = [];
  const run: Runner = (command, args, options) => {
    commands.push(`${command} ${args[0]}`);
    return runCommand(command, args, options);
  };
  return { run, commands };
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
    const checkout = await ensureCheckout(REF, currentCommits(fixture), options);
    expect(fs.readFileSync(path.join(checkout.worktreePath, "src/b.ts"), "utf8")).toContain(
      "b = 1",
    );
    expect(checkout.headSha).toMatch(/^[0-9a-f]{40}$/);

    const again = await ensureCheckout(REF, currentCommits(fixture), options);
    expect(again.worktreePath).toBe(checkout.worktreePath);

    const diffs = await diffCheckout(checkout);
    expect(diffs.map((diff) => [diff.path, diff.status])).toEqual([
      ["src/a.ts", "modified"],
      ["src/b.ts", "added"],
    ]);
  });

  it("creates the cache tree so only the owner can enter it", async () => {
    const options = { cacheRoot: fixture.cacheRoot, remoteUrl: fixture.origin };
    await ensureCheckout(REF, currentCommits(fixture), options);
    for (const directory of [
      fixture.cacheRoot,
      path.join(fixture.cacheRoot, "repos"),
      path.join(fixture.cacheRoot, "repos", REF.owner),
      path.join(fixture.cacheRoot, "worktrees", REF.owner, REF.repo),
    ]) {
      expect(fs.statSync(directory).mode & 0o777).toBe(0o700);
    }
  });

  it("links workspace packages so imports by package name resolve in the checkout", async () => {
    pushFeatureCommit(fixture, REF.number, {
      "packages/ui/package.json": JSON.stringify({ name: "@acme/ui" }),
    });
    const options = { cacheRoot: fixture.cacheRoot, remoteUrl: fixture.origin };
    const checkout = await ensureCheckout(REF, currentCommits(fixture), options);
    const link = path.join(checkout.worktreePath, "node_modules/@acme/ui");
    expect(fs.realpathSync(link)).toBe(
      fs.realpathSync(path.join(checkout.worktreePath, "packages/ui")),
    );
  });

  it("diffs a merged PR against the base it was opened on, not today's base", async () => {
    const openedOn = mainOf(fixture);
    squashMergeFeature(fixture, {
      "src/a.ts": "export const a = 2;\n",
      "src/b.ts": "export const b = 1;\n",
    });
    const checkout = await ensureCheckout(
      REF,
      { baseBranch: "main", baseSha: openedOn, headSha: headOf(fixture, REF.number) },
      { cacheRoot: fixture.cacheRoot, remoteUrl: fixture.origin },
    );
    const diffs = await diffCheckout(checkout);
    expect(diffs.map((diff) => diff.path)).toEqual(["src/a.ts", "src/b.ts"]);
  });

  it("never parses a from-revision as a git option", async () => {
    const options = { cacheRoot: fixture.cacheRoot, remoteUrl: fixture.origin };
    const checkout = await ensureCheckout(REF, currentCommits(fixture), options);
    const target = path.join(fixture.cacheRoot, "written-by-git");
    await expect(diffCheckout(checkout, `--output=${target}`)).rejects.toThrow();
    expect(fs.existsSync(target)).toBe(false);
  });

  it("counts how often files changed in history", async () => {
    const checkout = await ensureCheckout(REF, currentCommits(fixture), {
      cacheRoot: fixture.cacheRoot,
      remoteUrl: fixture.origin,
    });
    const churn = await fileChurn(checkout);
    expect(churn.get("src/a.ts")).toBe(2);
    expect(churn.get("README.md")).toBe(1);
  });

  it("skips the network fetch when both commits are already cached", async () => {
    const { run, commands } = recordingRunner();
    const options = { cacheRoot: fixture.cacheRoot, remoteUrl: fixture.origin, run };
    await ensureCheckout(REF, currentCommits(fixture), options);
    commands.length = 0;
    const again = await ensureCheckout(REF, currentCommits(fixture), options);
    expect(commands).not.toContain("git fetch");
    expect(again.headSha).toBe(headOf(fixture, REF.number));
  });

  it("fetches when the PR head moved since the last checkout", async () => {
    const { run, commands } = recordingRunner();
    const options = { cacheRoot: fixture.cacheRoot, remoteUrl: fixture.origin, run };
    await ensureCheckout(REF, currentCommits(fixture), options);
    pushFeatureCommit(fixture, REF.number, { "src/c.ts": "export const c = 1;\n" });
    commands.length = 0;
    const moved = await ensureCheckout(REF, currentCommits(fixture), options);
    expect(commands).toContain("git fetch");
    expect(moved.headSha).toBe(headOf(fixture, REF.number));
  });
});
