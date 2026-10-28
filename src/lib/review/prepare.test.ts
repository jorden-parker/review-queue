import fs from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { PullRequest } from "@/lib/github/gh";
import { prKey } from "@/lib/pr-ref";
import { SessionStore } from "@/lib/session/store";
import {
  createFixtureRepo,
  headOf,
  mainOf,
  pushFeatureCommit,
  removeFixtureRepo,
  type FixtureRepo,
} from "@/test/git-fixture";
import { findPrepared, loadReview, markReviewSeen, type ReviewDeps } from "./prepare";

const REF = { owner: "acme", repo: "app", number: 5 };

function pullRequest(headSha: string, baseSha: string): PullRequest {
  return {
    ref: REF,
    title: "Add retry",
    body: "",
    bodyHtml: "",
    url: "",
    author: "sam",
    baseRef: "main",
    baseSha,
    headRef: "feature",
    headSha,
    additions: 0,
    deletions: 0,
    changedFiles: 0,
  };
}

describe("loadReview", () => {
  let fixture: FixtureRepo;
  let deps: ReviewDeps;
  let warmed: string[];

  beforeEach(() => {
    warmed = [];
    fixture = createFixtureRepo(
      {
        "src/client.ts":
          "export function fetchUser(id: string) {\n  return id;\n}\nexport const a = fetchUser('1');\n",
      },
      {
        "src/client.ts":
          "export function fetchUser(id: string, retries: number) {\n  return id;\n}\nexport const a = fetchUser('1', 3);\n",
        "src/retry.ts": "export function retry() {\n  console.log('retrying');\n}\n",
        "src/types.ts": "export type Options = { retries: number };\n",
        "scripts/run.sh": "echo retry\n",
      },
      REF.number,
    );
    deps = {
      fetchPullRequest: async () => pullRequest(headOf(fixture, REF.number), mainOf(fixture)),
      store: new SessionStore(":memory:"),
      checkoutOptions: { cacheRoot: fixture.cacheRoot, remoteUrl: fixture.origin },
      languageClients: () => async (file) => {
        warmed.push(file);
        return null;
      },
    };
  });

  afterEach(() => removeFixtureRepo(fixture));

  it("builds a reading path and hotspots and warms language servers for changed code", async () => {
    const review = await loadReview(REF, deps);
    expect(review.steps[0].role).toBe("types");
    expect(review.startStepId).toBe(review.steps[0].id);
    expect(review.hotspots.map((hotspot) => hotspot.rule)).toEqual(
      expect.arrayContaining(["signature-change", "debug-output"]),
    );
    expect(warmed).toEqual(expect.arrayContaining(["src/client.ts", "src/retry.ts"]));
    expect(warmed).not.toContain("scripts/run.sh");
    expect(review.files[0].highlighted[0].length).toBe(review.files[0].hunks[0].lines.length);
    expect(review.session.lastHeadSha).toBeNull();
  });

  it("writes nothing to the session when it loads", async () => {
    await loadReview(REF, deps);
    expect(deps.store.getSession(prKey(REF))).toMatchObject({
      lastHeadSha: null,
      baselineHeadSha: null,
      updatedAt: null,
    });
  });

  it("only offers symbol jumps in files a parser understands", async () => {
    const review = await loadReview(REF, deps);
    const navigable = Object.fromEntries(review.files.map((file) => [file.path, file.navigable]));
    expect(navigable).toMatchObject({ "scripts/run.sh": false, "src/retry.ts": true });
  });

  it("remembers the PR title when the head is marked seen", async () => {
    const review = await loadReview(REF, deps);
    await markReviewSeen(REF, review.headSha, deps.store);
    deps.store.setStepDone(prKey(REF), "s1", true);
    expect(deps.store.inProgress()[0]).toMatchObject({ key: prKey(REF), title: "Add retry" });
  });

  it("returns the latest description for an unchanged head", async () => {
    await loadReview(REF, deps);
    const head = headOf(fixture, REF.number);
    deps.fetchPullRequest = async () => ({
      ...pullRequest(head, mainOf(fixture)),
      bodyHtml: "<p>fresh</p>",
    });
    const review = await loadReview(REF, deps);
    expect(review.pr.bodyHtml).toBe("<p>fresh</p>");
  });

  it("reopens finished steps whose files changed when the new head is marked seen", async () => {
    const first = await loadReview(REF, deps);
    await markReviewSeen(REF, first.headSha, deps.store);
    const key = prKey(REF);
    for (const step of first.steps) deps.store.setStepDone(key, step.id, true);

    pushFeatureCommit(fixture, REF.number, {
      "src/retry.ts": "export function retry() {\n  return 1;\n}\n",
    });
    const second = await loadReview(REF, deps);
    const seen = await markReviewSeen(REF, second.headSha, deps.store);

    const retryStep = second.steps.find((step) =>
      step.files.some((file) => file.path === "src/retry.ts"),
    )!;
    expect(seen?.reopenedStepIds).toEqual([retryStep.id]);
    expect(seen?.session.doneSteps).not.toContain(retryStep.id);
    expect(seen?.session.baselineHeadSha).toBe(first.headSha);
  });

  it("reopens nothing when the same head is marked seen twice", async () => {
    const review = await loadReview(REF, deps);
    await markReviewSeen(REF, review.headSha, deps.store);
    expect((await markReviewSeen(REF, review.headSha, deps.store))?.reopenedStepIds).toEqual([]);
  });

  it("returns null for a head that was never loaded", async () => {
    expect(await markReviewSeen(REF, "f".repeat(40), deps.store)).toBeNull();
  });

  it("keeps the two newest heads of a pull request and forgets older ones", async () => {
    (globalThis as { reviewQueuePrepared?: Map<string, unknown> }).reviewQueuePrepared?.clear();
    const first = await loadReview(REF, deps);
    pushFeatureCommit(fixture, REF.number, {
      "src/retry.ts": "export function retry() {\n  return 1;\n}\n",
    });
    const second = await loadReview(REF, deps);
    pushFeatureCommit(fixture, REF.number, {
      "src/retry.ts": "export function retry() {\n  return 2;\n}\n",
    });
    const third = await loadReview(REF, deps);
    expect(findPrepared(REF, first.headSha)).toBeNull();
    expect(findPrepared(REF, second.headSha)).not.toBeNull();
    expect(findPrepared(REF, third.headSha)).not.toBeNull();
    expect(
      fs.existsSync(path.join(fixture.cacheRoot, "worktrees", REF.owner, REF.repo, first.headSha)),
    ).toBe(true);
  });
});

describe("loadReview busy function changes", () => {
  let fixture: FixtureRepo;
  let deps: ReviewDeps;

  beforeEach(() => {
    fixture = createFixtureRepo(
      {
        "src/format.ts": "export function money(cents: number) {\n  return String(cents);\n}\n",
        "src/a.ts": [
          'import { money } from "./format";',
          "export const a1 = money(1);",
          "export const a2 = money(2);",
          "export const a3 = money(3);",
          "export const a4 = money(4);",
          "export const a5 = money(5);",
          "",
        ].join("\n"),
      },
      {
        "src/format.ts":
          "export function money(cents: number) {\n  return (cents / 100).toFixed(2);\n}\n",
      },
      REF.number,
    );
    deps = {
      fetchPullRequest: async () => pullRequest(headOf(fixture, REF.number), mainOf(fixture)),
      store: new SessionStore(":memory:"),
      checkoutOptions: { cacheRoot: fixture.cacheRoot, remoteUrl: fixture.origin },
      languageClients: () => async () => null,
    };
  });

  afterEach(() => removeFixtureRepo(fixture));

  it("flags a body-only change to a function with many callers at its definition", async () => {
    const review = await loadReview(REF, deps);
    const busy = review.hotspots.find((hotspot) => hotspot.rule === "busy-function-change");
    expect(busy).toMatchObject({ path: "src/format.ts", line: 1 });
    expect(busy?.title).toContain("money is used in");
  });
});
