import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ReviewComment } from "@/lib/github/gh";
import { conversation, sessionStore } from "@/lib/review/services";

const github = {
  replies: [] as { commentId: number; body: string }[],
  comments: [] as ReviewComment[],
  failure: null as string | null,
};

vi.mock("@/lib/github/gh", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/github/gh")>()),
  listReviewComments: async () => github.comments,
  listReviews: async () => [],
  postReplyToReviewComment: async (_ref: unknown, commentId: number, body: string) => {
    if (github.failure) throw new Error(github.failure);
    github.replies.push({ commentId, body });
    github.comments.push({
      id: 77,
      inReplyTo: commentId,
      path: "a.ts",
      line: 3,
      side: "RIGHT",
      author: "sam",
      body,
      url: REPLY_URL,
      createdAt: "2026-10-01T12:00:00Z",
    });
    return { id: 77, url: REPLY_URL };
  },
}));

process.env.REVIEW_QUEUE_DB = ":memory:";

const { POST } = await import("./route");

const REF = { owner: "acme", repo: "app", number: 7 };
const REPLY_URL = "https://github.com/acme/app/pull/7#discussion_r77";
const REPLY_INVALID = "A reply needs a comment id and 1 to 10000 characters.";
const REPLY_FAILED =
  "GitHub did not accept the reply. It may still have been saved, so check the conversation before you try again.";

function context(number = "7") {
  return { params: Promise.resolve({ owner: "acme", repo: "app", number }) };
}

function request(body: unknown) {
  return new Request("http://test/api", { method: "POST", body: JSON.stringify(body) });
}

describe("POST reply", () => {
  beforeEach(() => {
    github.replies = [];
    github.comments = [];
    github.failure = null;
  });

  it("rejects a bad reference, a body that is not JSON, and an empty or over-long reply", async () => {
    const badReference = await POST(request({ commentId: 5, body: "Thanks" }), context("x"));
    expect(badReference.status).toBe(400);
    expect(await badReference.json()).toEqual({ error: "Bad pull request reference" });

    const notJson = await POST(
      new Request("http://test/api", { method: "POST", body: "{nope" }),
      context(),
    );
    const blank = await POST(request({ commentId: 5, body: "   " }), context());
    const tooLong = await POST(request({ commentId: 5, body: "x".repeat(10_001) }), context());
    for (const response of [notJson, blank, tooLong]) {
      expect(response.status).toBe(400);
      expect(await response.json()).toEqual({ error: REPLY_INVALID });
    }
    expect(github.replies).toEqual([]);
  });

  it("accepts a reply of exactly 10000 characters", async () => {
    const response = await POST(request({ commentId: 5, body: "x".repeat(10_000) }), context());
    expect(response.status).toBe(200);
  });

  it("posts the trimmed reply to the thread and records a receipt", async () => {
    const response = await POST(request({ commentId: 5, body: "  Thanks  " }), context());
    expect(response.status).toBe(200);
    expect(github.replies).toEqual([{ commentId: 5, body: "Thanks" }]);
    const session = await response.json();
    expect(session.replyReceipts[0]).toEqual({
      replyId: 77,
      parentCommentId: 5,
      url: REPLY_URL,
      body: "Thanks",
      postedAt: expect.any(String),
    });
  });

  it("answers 502 with the fixed message and records nothing when GitHub refuses", async () => {
    github.failure = "gh: 422 secret detail";
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});
    const response = await POST(request({ commentId: 5, body: "Thanks" }), context("9"));
    logged.mockRestore();
    expect(response.status).toBe(502);
    const text = await response.text();
    expect(JSON.parse(text)).toEqual({ error: REPLY_FAILED });
    expect(text).not.toContain("secret detail");
    expect(sessionStore().getSession("acme/app#9").replyReceipts).toEqual([]);
  });

  it("drops the cached conversation so the next read shows the reply", async () => {
    expect((await conversation(REF)).comments).toEqual([]);
    const response = await POST(request({ commentId: 5, body: "Thanks" }), context());
    expect(response.status).toBe(200);
    expect((await conversation(REF)).comments.map((comment) => comment.id)).toEqual([77]);
  });
});
