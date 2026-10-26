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

const noCache = { getCached: () => null, setCached: () => {} };

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

  it("reads PR metadata from the REST API", async () => {
    const body = JSON.stringify({
      title: "Add cache",
      body: null,
      body_html: "<p>Adds a cache</p>",
      html_url: "https://github.com/acme/app/pull/7",
      user: { login: "sam" },
      base: { ref: "main", sha: "base1" },
      head: { ref: "cache", sha: "abc" },
      additions: 10,
      deletions: 2,
      changed_files: 3,
    });
    const { run, calls } = fakeRunner(`HTTP/2.0 200 OK\r\nEtag: "e1"\r\n\r\n${body}`);
    const pr = await getPullRequest(REF, noCache, run);
    expect(calls[0].args).toEqual([
      "api",
      "-i",
      "repos/acme/app/pulls/7",
      "-H",
      "Accept: application/vnd.github.full+json",
    ]);
    expect(pr).toEqual({
      ref: REF,
      title: "Add cache",
      body: "",
      bodyHtml: "<p>Adds a cache</p>",
      url: "https://github.com/acme/app/pull/7",
      author: "sam",
      baseRef: "main",
      baseSha: "base1",
      headRef: "cache",
      headSha: "abc",
      additions: 10,
      deletions: 2,
      changedFiles: 3,
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
