import { describe, expect, it } from "vitest";
import type { RunOptions } from "@/lib/exec";
import {
  getPullRequest,
  listReviewComments,
  listReviewRequests,
  listLinkedIssues,
  listReviews,
  postReplyToReviewComment,
  submitReview,
  viewerLogin,
} from "./gh";

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
    expect(calls[0].args).toContain("--limit=100");
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
    const created = { id: 42, html_url: "https://github.com/acme/app/pull/7#pullrequestreview-42" };
    const { run, calls } = fakeRunner(JSON.stringify(created));
    const posted = await submitReview(
      REF,
      {
        event: "COMMENT",
        body: "Looks good",
        commitId: "abc",
        comments: [{ path: "a.ts", line: 3, side: "RIGHT", body: "nit: rename" }],
      },
      run,
    );
    expect(posted).toEqual({ id: 42, url: created.html_url });
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

  it("posts a deleted-line comment on the old side and a range with its start", async () => {
    const created = { id: 43, html_url: "https://github.com/acme/app/pull/7#pullrequestreview-43" };
    const { run, calls } = fakeRunner(JSON.stringify(created));
    await submitReview(
      REF,
      {
        event: "COMMENT",
        body: "",
        commitId: "abc",
        comments: [
          { path: "a.ts", line: 6, side: "LEFT", body: "why removed?" },
          { path: "a.ts", line: 9, side: "RIGHT", startLine: 4, body: "one helper" },
        ],
      },
      run,
    );
    expect(JSON.parse(calls[0].options?.input ?? "").comments).toEqual([
      { path: "a.ts", line: 6, side: "LEFT", body: "why removed?" },
      {
        path: "a.ts",
        line: 9,
        side: "RIGHT",
        start_line: 4,
        start_side: "RIGHT",
        body: "one helper",
      },
    ]);
  });

  it("posts a reply to a review comment through the API", async () => {
    const created = { id: 77, html_url: "https://github.com/acme/app/pull/7#discussion_r77" };
    const { run, calls } = fakeRunner(JSON.stringify(created));
    const posted = await postReplyToReviewComment(REF, 5, "Thanks", run);
    expect(posted).toEqual({ id: 77, url: created.html_url });
    expect(calls[0].args).toEqual([
      "api",
      "--method",
      "POST",
      "repos/acme/app/pulls/7/comments/5/replies",
      "--input",
      "-",
    ]);
    expect(JSON.parse(calls[0].options?.input ?? "")).toEqual({ body: "Thanks" });
  });

  it("reads the signed-in login from the user endpoint", async () => {
    const { run, calls } = fakeRunner(JSON.stringify({ login: "jorden", id: 1 }));
    expect(await viewerLogin(run)).toBe("jorden");
    expect(calls[0].args).toEqual(["api", "user"]);
  });

  it("refuses a user response without a login", async () => {
    const { run } = fakeRunner(JSON.stringify({ id: 1 }));
    await expect(viewerLogin(run)).rejects.toThrow("no login");
  });

  it("passes a failed reply call on to the caller", async () => {
    const run = async () => {
      throw new Error("gh api failed");
    };
    await expect(postReplyToReviewComment(REF, 5, "Thanks", run)).rejects.toThrow("gh api failed");
  });

  it("lists inline review comments, including replies and outdated ones", async () => {
    const { run, calls } = fakeRunner(
      `HTTP/2.0 200 OK\r\n\r\n${JSON.stringify([
        {
          id: 1,
          in_reply_to_id: null,
          path: "a.ts",
          line: 3,
          side: "RIGHT",
          user: { login: "sam" },
          body: "Rename this",
          html_url: "https://github.com/acme/app/pull/7#discussion_r1",
          created_at: "2026-10-01T10:00:00Z",
          pull_request_review_id: 9,
        },
        {
          id: 2,
          in_reply_to_id: 1,
          path: "a.ts",
          line: null,
          original_line: 3,
          side: "LEFT",
          user: null,
          body: "Done",
          html_url: "https://github.com/acme/app/pull/7#discussion_r2",
          created_at: "2026-10-02T10:00:00Z",
          pull_request_review_id: 10,
        },
      ])}`,
    );
    expect(await listReviewComments(REF, noCache, run)).toEqual([
      {
        id: 1,
        inReplyTo: null,
        path: "a.ts",
        line: 3,
        side: "RIGHT",
        author: "sam",
        body: "Rename this",
        url: "https://github.com/acme/app/pull/7#discussion_r1",
        createdAt: "2026-10-01T10:00:00Z",
      },
      {
        id: 2,
        inReplyTo: 1,
        path: "a.ts",
        line: null,
        side: "LEFT",
        author: "",
        body: "Done",
        url: "https://github.com/acme/app/pull/7#discussion_r2",
        createdAt: "2026-10-02T10:00:00Z",
      },
    ]);
    expect(calls[0].args).toEqual([
      "api",
      "-i",
      "repos/acme/app/pulls/7/comments?per_page=100&page=1",
    ]);
  });

  it("lists reviews with their state and submission time", async () => {
    const { run, calls } = fakeRunner(
      `HTTP/2.0 200 OK\r\n\r\n${JSON.stringify([
        {
          id: 9,
          user: { login: "sam" },
          state: "CHANGES_REQUESTED",
          body: "Please split this",
          html_url: "https://github.com/acme/app/pull/7#pullrequestreview-9",
          submitted_at: "2026-10-01T11:00:00Z",
          commit_id: "abc",
        },
        {
          id: 10,
          user: { login: "kim" },
          state: "PENDING",
          body: "",
          html_url: "https://github.com/acme/app/pull/7#pullrequestreview-10",
          submitted_at: null,
          commit_id: "def",
        },
      ])}`,
    );
    expect(await listReviews(REF, noCache, run)).toEqual([
      {
        id: 9,
        author: "sam",
        state: "CHANGES_REQUESTED",
        body: "Please split this",
        url: "https://github.com/acme/app/pull/7#pullrequestreview-9",
        submittedAt: "2026-10-01T11:00:00Z",
        commitId: "abc",
      },
      {
        id: 10,
        author: "kim",
        state: "PENDING",
        body: "",
        url: "https://github.com/acme/app/pull/7#pullrequestreview-10",
        submittedAt: null,
        commitId: "def",
      },
    ]);
    expect(calls[0].args).toEqual(["api", "-i", "repos/acme/app/pulls/7/reviews?per_page=100"]);
  });
});

describe("listLinkedIssues", () => {
  const closing = (owner: string, repo: string, number: number) => ({
    number,
    url: `https://github.com/${owner}/${repo}/issues/${number}`,
    repository: { name: repo, owner: { login: owner } },
  });

  const issueResponse = (
    owner: string,
    repo: string,
    number: number,
    title: string,
    state: "open" | "closed",
    bodyHtml: string | null,
  ) => ({
    title,
    state,
    html_url: `https://github.com/${owner}/${repo}/issues/${number}`,
    body_html: bodyHtml,
  });

  function linkedIssueRunner(references: unknown[], issues: Record<string, object | Error>) {
    const calls: Call[] = [];
    const run = async (command: string, args: string[], options?: RunOptions) => {
      calls.push({ command, args, options });
      if (args[0] === "pr") return JSON.stringify({ closingIssuesReferences: references });
      const issue = issues[args[2]];
      if (issue instanceof Error) throw issue;
      if (!issue) throw new Error("HTTP 404: Not Found");
      return `HTTP/2.0 200 OK\r\nEtag: "i"\r\n\r\n${JSON.stringify(issue)}`;
    };
    return { run, calls };
  }

  it("lists the issues a PR closes with their rendered bodies", async () => {
    const { run, calls } = linkedIssueRunner(
      [closing("acme", "app", 12), closing("other", "lib", 30)],
      {
        "repos/acme/app/issues/12": issueResponse(
          "acme",
          "app",
          12,
          "Crash on save",
          "open",
          "<p>It crashes</p>",
        ),
        "repos/other/lib/issues/30": issueResponse("other", "lib", 30, "Lib", "closed", null),
      },
    );
    const issues = await listLinkedIssues(REF, noCache, run);
    expect(calls[0].args).toEqual([
      "pr",
      "view",
      "7",
      "--repo",
      "acme/app",
      "--json",
      "closingIssuesReferences",
    ]);
    expect(issues).toEqual([
      {
        owner: "acme",
        repo: "app",
        number: 12,
        title: "Crash on save",
        state: "open",
        url: "https://github.com/acme/app/issues/12",
        bodyHtml: "<p>It crashes</p>",
      },
      {
        owner: "other",
        repo: "lib",
        number: 30,
        title: "Lib",
        state: "closed",
        url: "https://github.com/other/lib/issues/30",
        bodyHtml: "",
      },
    ]);
  });

  it("skips a reference whose owner is not a safe name, without fetching it", async () => {
    const { run, calls } = linkedIssueRunner([closing("..", "app", 5)], {});
    expect(await listLinkedIssues(REF, noCache, run)).toEqual([]);
    expect(calls.filter((call) => call.args[0] === "api")).toEqual([]);
  });

  it("drops an issue that cannot be read without failing the others", async () => {
    const { run } = linkedIssueRunner([closing("acme", "app", 12), closing("acme", "app", 13)], {
      "repos/acme/app/issues/12": issueResponse("acme", "app", 12, "Crash", "open", "<p>x</p>"),
      "repos/acme/app/issues/13": new Error("HTTP 404: Not Found"),
    });
    const issues = await listLinkedIssues(REF, noCache, run);
    expect(issues.map((issue) => issue.number)).toEqual([12]);
  });

  it("fetches at most three issues", async () => {
    const references = [1, 2, 3, 4].map((number) => closing("acme", "app", number));
    const issues = Object.fromEntries(
      [1, 2, 3, 4].map((number) => [
        `repos/acme/app/issues/${number}`,
        issueResponse("acme", "app", number, "T", "open", null),
      ]),
    );
    const { run, calls } = linkedIssueRunner(references, issues);
    expect(await listLinkedIssues(REF, noCache, run)).toHaveLength(3);
    expect(calls.filter((call) => call.args[0] === "api")).toHaveLength(3);
  });
});
