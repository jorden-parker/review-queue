import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { PullRequest } from "@/lib/github/gh";
import { SessionStore } from "@/lib/session/store";
import {
  createFixtureRepo,
  headOf,
  mainOf,
  pushFeatureCommit,
  removeFixtureRepo,
  type FixtureRepo,
} from "@/test/git-fixture";
import { findPrepared, loadReview, type ReviewDeps } from "./prepare";
import { interdiffFor } from "./interdiff";

const REF = { owner: "acme", repo: "app", number: 6 };

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

describe("interdiffFor", () => {
  let fixture: FixtureRepo;
  let deps: ReviewDeps;

  beforeEach(() => {
    fixture = createFixtureRepo(
      { "src/client.ts": "export const a = 1;\n" },
      {
        "src/client.ts": "export const a = 2;\n",
        "src/retry.ts": "export function retry() {\n  return 0;\n}\n",
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

  it("returns only the files and hunks that changed since the baseline head", async () => {
    const first = await loadReview(REF, deps);
    pushFeatureCommit(fixture, REF.number, {
      "src/retry.ts": "export function retry() {\n  return 1;\n}\n",
    });
    const second = await loadReview(REF, deps);
    const review = await findPrepared(REF, second.headSha)!;

    const interdiff = await interdiffFor(review, first.headSha);

    expect(interdiff).toMatchObject({ baselineHeadSha: first.headSha, headSha: second.headSha });
    expect(interdiff.files.map((file) => file.path)).toEqual(["src/retry.ts"]);
    expect(interdiff.files[0].hunks.length).toBeGreaterThan(0);
    expect(interdiff.files[0].highlighted).toHaveLength(interdiff.files[0].hunks.length);
  });
});
