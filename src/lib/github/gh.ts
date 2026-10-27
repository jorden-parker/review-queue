import type { Runner } from "@/lib/exec";
import { conditionalGet, type EtagCache } from "./conditional-get";
import { githubRun } from "./github-guard";
import type { PullRequestRef } from "@/lib/types";

export type ReviewRequest = {
  ref: PullRequestRef;
  title: string;
  url: string;
  author: string;
  updatedAt: string;
  isDraft: boolean;
};

export type PullRequest = {
  ref: PullRequestRef;
  title: string;
  body: string;
  bodyHtml: string;
  url: string;
  author: string;
  baseRef: string;
  baseSha: string;
  headRef: string;
  headSha: string;
  additions: number;
  deletions: number;
  changedFiles: number;
};

export type ReviewEvent = "APPROVE" | "REQUEST_CHANGES" | "COMMENT";

export type ReviewSubmission = {
  event: ReviewEvent;
  body: string;
  commitId: string;
  comments: { path: string; line: number; body: string }[];
};

type SearchResult = {
  number: number;
  title: string;
  url: string;
  repository: { nameWithOwner: string };
  author: { login: string };
  updatedAt: string;
  isDraft: boolean;
};

const RENDERED_BODY = "Accept: application/vnd.github.full+json";

const SEARCH_FIELDS = "number,title,url,repository,author,updatedAt,isDraft";

export const REVIEW_REQUEST_LIMIT = 100;

function refFromSearch(result: SearchResult): PullRequestRef {
  const [owner, repo] = result.repository.nameWithOwner.split("/");
  return { owner, repo, number: result.number };
}

export async function listReviewRequests(run: Runner = githubRun): Promise<ReviewRequest[]> {
  const output = await run("gh", [
    "search",
    "prs",
    "--review-requested=@me",
    "--state=open",
    `--limit=${REVIEW_REQUEST_LIMIT}`,
    `--json=${SEARCH_FIELDS}`,
  ]);
  return (JSON.parse(output) as SearchResult[]).map((result) => ({
    ref: refFromSearch(result),
    title: result.title,
    url: result.url,
    author: result.author.login,
    updatedAt: result.updatedAt,
    isDraft: result.isDraft,
  }));
}

export async function getPullRequest(
  ref: PullRequestRef,
  cache: EtagCache,
  run: Runner = githubRun,
): Promise<PullRequest> {
  const path = `repos/${ref.owner}/${ref.repo}/pulls/${ref.number}`;
  const pull = JSON.parse(await conditionalGet(path, cache, run, [RENDERED_BODY]));
  return {
    ref,
    title: pull.title,
    body: pull.body ?? "",
    bodyHtml: pull.body_html ?? "",
    url: pull.html_url,
    author: pull.user?.login ?? "",
    baseRef: pull.base.ref,
    baseSha: pull.base.sha,
    headRef: pull.head.ref,
    headSha: pull.head.sha,
    additions: pull.additions,
    deletions: pull.deletions,
    changedFiles: pull.changed_files,
  };
}

export async function submitReview(
  ref: PullRequestRef,
  review: ReviewSubmission,
  run: Runner = githubRun,
): Promise<void> {
  const payload = {
    event: review.event,
    body: review.body,
    commit_id: review.commitId,
    comments: review.comments.map((comment) => ({ ...comment, side: "RIGHT" })),
  };
  await run(
    "gh",
    [
      "api",
      "--method",
      "POST",
      `repos/${ref.owner}/${ref.repo}/pulls/${ref.number}/reviews`,
      "--input",
      "-",
    ],
    { input: JSON.stringify(payload) },
  );
}
