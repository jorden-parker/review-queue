import { describe, expect, it } from "vitest";
import type { RunOptions } from "@/lib/exec";
import { getPullRequest, listReviewRequests, submitReview } from "./gh";

type Call = { command: string; args: string[]; options?: RunOptions };

function fakeRunner(output: string) {
  const calls: Call[] = [];
  const run = async (command: string, args: string[], options?: RunOptions) => {
    calls.push({ command, args, options });
    return output;
  };
  return { run, calls };
}

const REF = { owner: "acme", repo: "app", number: 7 };

describe("github", () => {
  it("lists PRs requesting my review", async () => {
    const { run, calls } = fakeRunner(
      JSON.stringify([
        {
          number: 7,
          title: "Add cache",
          url: "https://github.com/acme/app/pull/7",
          repository: { nameWithOwner: "acme/app" },
          author: { login: "sam" },
          updatedAt: "2026-10-01T00:00:00Z",
          isDraft: false,
        },
      ]),
    );
    const requests = await listReviewRequests(run);
    expect(calls[0].args).toContain("--review-requested=@me");
    expect(requests[0]).toEqual({
      ref: REF,
      title: "Add cache",
      url: "https://github.com/acme/app/pull/7",
      author: "sam",
      updatedAt: "2026-10-01T00:00:00Z",
      isDraft: false,
    });
  });

  it("reads PR metadata", async () => {
    const { run, calls } = fakeRunner(
      JSON.stringify({
        title: "Add cache",
        body: "Speeds things up",
        url: "u",
        author: { login: "sam" },
        baseRefName: "main",
        baseRefOid: "base1",
        headRefName: "cache",
        headRefOid: "abc",
        additions: 10,
        deletions: 2,
        changedFiles: 3,
      }),
    );
    const pr = await getPullRequest(REF, run);
    expect(calls[0].args.slice(0, 3)).toEqual(["pr", "view", "7"]);
    expect(calls[0].args).toContain("acme/app");
    expect(pr).toMatchObject({
      title: "Add cache",
      author: "sam",
      headSha: "abc",
      baseRef: "main",
      baseSha: "base1",
    });
  });

  it("submits a review with line comments through the API", async () => {
    const { run, calls } = fakeRunner("{}");
    await submitReview(
      REF,
      {
        event: "COMMENT",
        body: "Looks good",
        commitId: "abc",
        comments: [{ path: "a.ts", line: 3, body: "nit: rename" }],
      },
      run,
    );
    expect(calls[0].args).toEqual([
      "api",
      "--method",
      "POST",
      "repos/acme/app/pulls/7/reviews",
      "--input",
      "-",
    ]);
    expect(JSON.parse(calls[0].options?.input ?? "")).toEqual({
      event: "COMMENT",
      body: "Looks good",
      commit_id: "abc",
      comments: [{ path: "a.ts", line: 3, side: "RIGHT", body: "nit: rename" }],
    });
  });
});
