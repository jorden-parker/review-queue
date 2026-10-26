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
import { loadReview, type ReviewDeps } from "./prepare";

const REF = { owner: "acme", repo: "app", number: 5 };

function pullRequest(headSha: string, baseSha: string): PullRequest {
  return {
    ref: REF,
    title: "Add retry",
    body: "",
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

  beforeEach(() => {
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
    };
  });

  afterEach(() => removeFixtureRepo(fixture));

  it("builds a reading path, hotspots and linkable names from a real checkout", async () => {
    const review = await loadReview(REF, deps);
    expect(review.steps[0].role).toBe("types");
    expect(review.startStepId).toBe(review.steps[0].id);
    expect(review.hotspots.map((hotspot) => hotspot.rule)).toEqual(
      expect.arrayContaining(["signature-change", "debug-output"]),
    );
    expect(review.linkableNames).toEqual(expect.arrayContaining(["fetchUser", "retry"]));
    expect(review.files[0].highlighted[0].length).toBe(review.files[0].hunks[0].lines.length);
    expect(review.session.lastHeadSha).toBe(review.headSha);
  });

  it("only offers symbol jumps in files a parser understands", async () => {
    const review = await loadReview(REF, deps);
    const navigable = Object.fromEntries(review.files.map((file) => [file.path, file.navigable]));
    expect(navigable).toMatchObject({ "scripts/run.sh": false, "src/retry.ts": true });
  });

  it("reopens finished steps whose files changed in new commits", async () => {
    const first = await loadReview(REF, deps);
    const key = prKey(REF);
    for (const step of first.steps) deps.store.setStepDone(key, step.id, true);

    pushFeatureCommit(fixture, REF.number, {
      "src/retry.ts": "export function retry() {\n  return 1;\n}\n",
    });
    const second = await loadReview(REF, deps);

    const retryStep = second.steps.find((step) =>
      step.files.some((file) => file.path === "src/retry.ts"),
    )!;
    expect(second.reopenedStepIds).toEqual([retryStep.id]);
    expect(second.session.doneSteps).not.toContain(retryStep.id);
  });
});
