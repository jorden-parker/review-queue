import { describe, expect, it } from "vitest";
import type { RunOptions } from "@/lib/exec";
import { loadConversation } from "./conversation";
import { CONVERSATION_MAX_PAGES, CONVERSATION_PAGE_SIZE } from "./gh";

type Call = { command: string; args: string[]; options?: RunOptions };

const REF = { owner: "acme", repo: "app", number: 7 };
const noCache = { getCached: () => null, setCached: () => {} };

function rawComment(id: number) {
  return {
    id,
    in_reply_to_id: null,
    path: "a.ts",
    line: 3,
    side: "RIGHT",
    user: { login: "sam" },
    body: "Rename this",
    html_url: `https://github.com/acme/app/pull/7#discussion_r${id}`,
    created_at: "2026-10-01T10:00:00Z",
  };
}

function rawReview(id: number) {
  return {
    id,
    user: { login: "kim" },
    state: "COMMENTED",
    body: "Looks fine",
    html_url: `https://github.com/acme/app/pull/7#pullrequestreview-${id}`,
    submitted_at: "2026-10-01T11:00:00Z",
    commit_id: "abc",
  };
}

function rawCommentPage(size: number, firstId = 1): unknown[] {
  return Array.from({ length: size }, (_, index) => rawComment(firstId + index));
}

function pageOf(path: string): number {
  return Number(new URLSearchParams(path.split("?")[1]).get("page") ?? 1);
}

function routedRunner(commentPages: unknown[][], reviews: unknown[]) {
  const calls: Call[] = [];
  const run = async (command: string, args: string[], options?: RunOptions) => {
    calls.push({ command, args, options });
    const path = args.at(-1) ?? "";
    const listing = path.includes("/comments?") ? (commentPages[pageOf(path) - 1] ?? []) : reviews;
    return `HTTP/2.0 200 OK\r\n\r\n${JSON.stringify(listing)}`;
  };
  return { run, calls };
}

function commentRequests(calls: Call[]): string[] {
  return calls.map((call) => call.args.at(-1) ?? "").filter((path) => path.includes("/comments?"));
}

describe("loadConversation", () => {
  it("loads the review comments and reviews of the pull request", async () => {
    const { run, calls } = routedRunner([[rawComment(1)]], [rawReview(9)]);
    const conversation = await loadConversation(REF, noCache, run);
    expect(conversation).toEqual({
      comments: [
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
      ],
      reviews: [
        {
          id: 9,
          author: "kim",
          state: "COMMENTED",
          body: "Looks fine",
          url: "https://github.com/acme/app/pull/7#pullrequestreview-9",
          submittedAt: "2026-10-01T11:00:00Z",
          commitId: "abc",
        },
      ],
      truncated: false,
    });
    expect(calls.map((call) => call.args.at(-1))).toEqual([
      "repos/acme/app/pulls/7/comments?per_page=100&page=1",
      "repos/acme/app/pulls/7/reviews?per_page=100",
    ]);
  });

  it("reads the next page while a page comes back full", async () => {
    const pages = [
      rawCommentPage(CONVERSATION_PAGE_SIZE),
      rawCommentPage(3, CONVERSATION_PAGE_SIZE + 1),
    ];
    const { run, calls } = routedRunner(pages, []);
    const conversation = await loadConversation(REF, noCache, run);
    expect(conversation.comments).toHaveLength(CONVERSATION_PAGE_SIZE + 3);
    expect(conversation.truncated).toBe(false);
    expect(commentRequests(calls)).toEqual([
      "repos/acme/app/pulls/7/comments?per_page=100&page=1",
      "repos/acme/app/pulls/7/comments?per_page=100&page=2",
    ]);
  });

  it("stops after five pages and flags the conversation as truncated", async () => {
    const pages = Array.from({ length: CONVERSATION_MAX_PAGES }, (_, index) =>
      rawCommentPage(CONVERSATION_PAGE_SIZE, index * CONVERSATION_PAGE_SIZE + 1),
    );
    const { run, calls } = routedRunner(pages, []);
    const conversation = await loadConversation(REF, noCache, run);
    expect(conversation.comments).toHaveLength(CONVERSATION_PAGE_SIZE * CONVERSATION_MAX_PAGES);
    expect(conversation.truncated).toBe(true);
    expect(commentRequests(calls)).toHaveLength(CONVERSATION_MAX_PAGES);
  });

  it("flags the conversation as truncated when the reviews fill their page", async () => {
    const fullReviewPage = Array.from({ length: CONVERSATION_PAGE_SIZE }, (_, index) =>
      rawReview(index + 1),
    );
    const { run } = routedRunner([[]], fullReviewPage);
    const conversation = await loadConversation(REF, noCache, run);
    expect(conversation.comments).toHaveLength(0);
    expect(conversation.truncated).toBe(true);
  });
});
