import { describe, expect, it } from "vitest";
import type { RunOptions } from "@/lib/exec";
import { loadConversation } from "./conversation";
import { CONVERSATION_PAGE_SIZE } from "./gh";

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

function routedRunner(comments: unknown[], reviews: unknown[]) {
  const calls: Call[] = [];
  const run = async (command: string, args: string[], options?: RunOptions) => {
    calls.push({ command, args, options });
    const listing = args.some((arg) => arg.endsWith("/comments?per_page=100")) ? comments : reviews;
    return `HTTP/2.0 200 OK\r\n\r\n${JSON.stringify(listing)}`;
  };
  return { run, calls };
}

describe("loadConversation", () => {
  it("loads the review comments and reviews of the pull request", async () => {
    const { run, calls } = routedRunner([rawComment(1)], [rawReview(9)]);
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
      "repos/acme/app/pulls/7/comments?per_page=100",
      "repos/acme/app/pulls/7/reviews?per_page=100",
    ]);
  });

  it("flags the conversation as truncated when a list fills the first page", async () => {
    const fullPage = Array.from({ length: CONVERSATION_PAGE_SIZE }, (_, index) =>
      rawComment(index + 1),
    );
    const { run } = routedRunner(fullPage, []);
    const conversation = await loadConversation(REF, noCache, run);
    expect(conversation.comments).toHaveLength(CONVERSATION_PAGE_SIZE);
    expect(conversation.truncated).toBe(true);
  });
});
