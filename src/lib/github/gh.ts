import { runCommand, type Runner } from "@/lib/exec";
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

const SEARCH_FIELDS = "number,title,url,repository,author,updatedAt,isDraft";
const VIEW_FIELDS =
  "title,body,url,author,baseRefName,baseRefOid,headRefName,headRefOid,additions,deletions,changedFiles";

function refFromSearch(result: SearchResult): PullRequestRef {
  const [owner, repo] = result.repository.nameWithOwner.split("/");
  return { owner, repo, number: result.number };
}

export async function listReviewRequests(run: Runner = runCommand): Promise<ReviewRequest[]> {
  const output = await run("gh", [
    "search",
    "prs",
    "--review-requested=@me",
    "--state=open",
    "--limit=50",
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
  run: Runner = runCommand,
): Promise<PullRequest> {
  const output = await run("gh", [
    "pr",
    "view",
    String(ref.number),
    "--repo",
    `${ref.owner}/${ref.repo}`,
    "--json",
    VIEW_FIELDS,
  ]);
  const view = JSON.parse(output);
  return {
    ref,
    title: view.title,
    body: view.body ?? "",
    url: view.url,
    author: view.author?.login ?? "",
    baseRef: view.baseRefName,
    baseSha: view.baseRefOid,
    headRef: view.headRefName,
    headSha: view.headRefOid,
    additions: view.additions,
    deletions: view.deletions,
    changedFiles: view.changedFiles,
  };
}

export async function submitReview(
  ref: PullRequestRef,
  review: ReviewSubmission,
  run: Runner = runCommand,
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
