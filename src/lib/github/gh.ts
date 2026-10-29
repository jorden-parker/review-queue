import type { Runner } from "@/lib/exec";
import { conditionalGet, type EtagCache } from "./conditional-get";
import { githubRun } from "./github-guard";
import type { PullRequestRef } from "@/lib/types";
import { parsePullRequestRef } from "@/lib/pr-ref";

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
  comments: {
    path: string;
    line: number;
    side: "LEFT" | "RIGHT";
    startLine?: number;
    body: string;
  }[];
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

export type LinkedIssue = {
  owner: string;
  repo: string;
  number: number;
  title: string;
  state: "open" | "closed";
  url: string;
  bodyHtml: string;
};

type ClosingReference = {
  number: number;
  repository: { name: string; owner: { login: string } };
};

type IssueResponse = {
  title: string;
  state: "open" | "closed";
  html_url: string;
  body_html?: string | null;
};

const LINKED_ISSUE_LIMIT = 3;

function closingReferenceRef(reference: ClosingReference): PullRequestRef | null {
  return parsePullRequestRef(
    `${reference.repository.owner.login}/${reference.repository.name}#${reference.number}`,
  );
}

async function loadLinkedIssue(
  ref: PullRequestRef,
  cache: EtagCache,
  run: Runner,
): Promise<LinkedIssue> {
  const path = `repos/${ref.owner}/${ref.repo}/issues/${ref.number}`;
  const issue = JSON.parse(
    await conditionalGet(path, cache, run, [RENDERED_BODY]),
  ) as IssueResponse;
  return {
    owner: ref.owner,
    repo: ref.repo,
    number: ref.number,
    title: issue.title,
    state: issue.state,
    url: issue.html_url,
    bodyHtml: issue.body_html ?? "",
  };
}

export async function listLinkedIssues(
  ref: PullRequestRef,
  cache: EtagCache,
  run: Runner = githubRun,
): Promise<LinkedIssue[]> {
  const output = await run("gh", [
    "pr",
    "view",
    String(ref.number),
    "--repo",
    `${ref.owner}/${ref.repo}`,
    "--json",
    "closingIssuesReferences",
  ]);
  const { closingIssuesReferences } = JSON.parse(output) as {
    closingIssuesReferences: ClosingReference[];
  };
  const issueRefs = closingIssuesReferences
    .map(closingReferenceRef)
    .filter((issueRef): issueRef is PullRequestRef => issueRef !== null)
    .slice(0, LINKED_ISSUE_LIMIT);
  const settled = await Promise.allSettled(
    issueRefs.map((issueRef) => loadLinkedIssue(issueRef, cache, run)),
  );
  return settled.flatMap((result) => (result.status === "fulfilled" ? [result.value] : []));
}

export async function viewerLogin(run: Runner = githubRun): Promise<string> {
  const user = JSON.parse(await run("gh", ["api", "user"]));
  if (typeof user.login !== "string" || user.login === "") {
    throw new Error("GitHub user response has no login");
  }
  return user.login;
}

export async function submitReview(
  ref: PullRequestRef,
  review: ReviewSubmission,
  run: Runner = githubRun,
): Promise<{ id: number; url: string }> {
  const payload = {
    event: review.event,
    body: review.body,
    commit_id: review.commitId,
    comments: review.comments.map(toGitHubComment),
  };
  const output = await run(
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
  const created = JSON.parse(output) as { id: number; html_url: string };
  return { id: created.id, url: created.html_url };
}

function toGitHubComment({ startLine, ...comment }: ReviewSubmission["comments"][number]) {
  if (startLine === undefined) return comment;
  return { ...comment, start_line: startLine, start_side: comment.side };
}

export async function postReplyToReviewComment(
  ref: PullRequestRef,
  commentId: number,
  body: string,
  run: Runner = githubRun,
): Promise<{ id: number; url: string }> {
  const output = await run(
    "gh",
    ["api", "--method", "POST", `${pullPath(ref)}/comments/${commentId}/replies`, "--input", "-"],
    { input: JSON.stringify({ body }) },
  );
  const created = JSON.parse(output) as { id: number; html_url: string };
  return { id: created.id, url: created.html_url };
}

export type ReviewComment = {
  id: number;
  inReplyTo: number | null;
  path: string;
  line: number | null;
  side: "LEFT" | "RIGHT";
  author: string;
  body: string;
  url: string;
  createdAt: string;
};

export type PostedReview = {
  id: number;
  author: string;
  state: "APPROVED" | "CHANGES_REQUESTED" | "COMMENTED" | "DISMISSED" | "PENDING";
  body: string;
  url: string;
  submittedAt: string | null;
  commitId: string;
};

type RawUser = { login: string } | null;

type RawReviewComment = {
  id: number;
  in_reply_to_id?: number | null;
  path: string;
  line: number | null;
  side: "LEFT" | "RIGHT";
  user: RawUser;
  body: string;
  html_url: string;
  created_at: string;
};

type RawReview = {
  id: number;
  user: RawUser;
  state: PostedReview["state"];
  body: string;
  html_url: string;
  submitted_at: string | null;
  commit_id: string;
};

export const CONVERSATION_PAGE_SIZE = 100;
export const CONVERSATION_MAX_PAGES = 5;

function pullPath(ref: PullRequestRef): string {
  return `repos/${ref.owner}/${ref.repo}/pulls/${ref.number}`;
}

function toReviewComment(raw: RawReviewComment): ReviewComment {
  return {
    id: raw.id,
    inReplyTo: raw.in_reply_to_id ?? null,
    path: raw.path,
    line: raw.line,
    side: raw.side,
    author: raw.user?.login ?? "",
    body: raw.body,
    url: raw.html_url,
    createdAt: raw.created_at,
  };
}

function toPostedReview(raw: RawReview): PostedReview {
  return {
    id: raw.id,
    author: raw.user?.login ?? "",
    state: raw.state,
    body: raw.body,
    url: raw.html_url,
    submittedAt: raw.submitted_at,
    commitId: raw.commit_id,
  };
}

async function listCommentPage(
  ref: PullRequestRef,
  page: number,
  cache: EtagCache,
  run: Runner,
): Promise<RawReviewComment[]> {
  const path = `${pullPath(ref)}/comments?per_page=${CONVERSATION_PAGE_SIZE}&page=${page}`;
  return JSON.parse(await conditionalGet(path, cache, run)) as RawReviewComment[];
}

export async function listReviewComments(
  ref: PullRequestRef,
  cache: EtagCache,
  run: Runner = githubRun,
): Promise<ReviewComment[]> {
  const rows: RawReviewComment[] = [];
  for (let page = 1; page <= CONVERSATION_MAX_PAGES; page += 1) {
    const batch = await listCommentPage(ref, page, cache, run);
    rows.push(...batch);
    if (batch.length < CONVERSATION_PAGE_SIZE) break;
  }
  return rows.map(toReviewComment);
}

export async function listReviews(
  ref: PullRequestRef,
  cache: EtagCache,
  run: Runner = githubRun,
): Promise<PostedReview[]> {
  const path = `${pullPath(ref)}/reviews?per_page=${CONVERSATION_PAGE_SIZE}`;
  const reviews = JSON.parse(await conditionalGet(path, cache, run)) as RawReview[];
  return reviews.map(toPostedReview);
}
