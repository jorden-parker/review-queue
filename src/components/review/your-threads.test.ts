import { describe, expect, it } from "vitest";
import type { ReviewComment } from "@/lib/github/gh";
import { threadsFor, type Thread } from "./conversation-threads";
import { newReplyCount, yourThreads } from "./your-threads";

function comment(
  overrides: Partial<ReviewComment> & Pick<ReviewComment, "id" | "author">,
): ReviewComment {
  return {
    inReplyTo: null,
    path: "src/a.ts",
    line: 10,
    side: "RIGHT",
    body: "",
    url: "",
    createdAt: "2026-10-01T00:00:00Z",
    ...overrides,
  };
}

function threadsOf(...comments: ReviewComment[]): Thread[] {
  return threadsFor(comments);
}

describe("yourThreads", () => {
  it("returns nothing when the viewer is unknown", () => {
    const threads = threadsOf(comment({ id: 1, author: "me" }));
    expect(yourThreads(threads, null)).toEqual([]);
  });

  it("leaves out threads the viewer is not in", () => {
    const threads = threadsOf(
      comment({ id: 1, author: "someone" }),
      comment({ id: 2, author: "other", inReplyTo: 1, createdAt: "2026-10-02T00:00:00Z" }),
    );
    expect(yourThreads(threads, "me")).toEqual([]);
  });

  it("marks a thread new-reply when someone else spoke last", () => {
    const threads = threadsOf(
      comment({ id: 1, author: "me" }),
      comment({ id: 2, author: "reviewer", inReplyTo: 1, createdAt: "2026-10-02T00:00:00Z" }),
    );
    const [mine] = yourThreads(threads, "me");
    expect(mine.state).toBe("new-reply");
    expect(mine.thread.root.id).toBe(1);
  });

  it("marks a thread waiting when the viewer spoke last", () => {
    const threads = threadsOf(
      comment({ id: 1, author: "reviewer" }),
      comment({ id: 2, author: "me", inReplyTo: 1, createdAt: "2026-10-02T00:00:00Z" }),
    );
    expect(yourThreads(threads, "me")[0].state).toBe("waiting");
  });

  it("orders new replies first, then outdated threads, then the oldest root", () => {
    const threads = threadsOf(
      comment({ id: 1, author: "me", createdAt: "2026-10-01T00:00:00Z" }),
      comment({ id: 2, author: "me", createdAt: "2026-10-02T00:00:00Z", line: null }),
      comment({ id: 3, author: "me", createdAt: "2026-10-03T00:00:00Z", line: null }),
      comment({ id: 4, author: "me", createdAt: "2026-10-04T00:00:00Z" }),
      comment({ id: 5, author: "reviewer", inReplyTo: 4, createdAt: "2026-10-05T00:00:00Z" }),
      comment({ id: 6, author: "reviewer", inReplyTo: 2, createdAt: "2026-10-06T00:00:00Z" }),
    );
    const ids = yourThreads(threads, "me").map(({ thread }) => thread.root.id);
    expect(ids).toEqual([2, 4, 3, 1]);
  });

  it("matches logins case-insensitively", () => {
    const threads = threadsOf(
      comment({ id: 1, author: "Me" }),
      comment({ id: 2, author: "reviewer", inReplyTo: 1, createdAt: "2026-10-02T00:00:00Z" }),
    );
    expect(yourThreads(threads, "me")[0].state).toBe("new-reply");
  });
});

describe("newReplyCount", () => {
  it("counts threads with a new reply", () => {
    const threads = threadsOf(
      comment({ id: 1, author: "me" }),
      comment({ id: 2, author: "reviewer", inReplyTo: 1, createdAt: "2026-10-02T00:00:00Z" }),
      comment({ id: 3, author: "me", createdAt: "2026-10-03T00:00:00Z" }),
      comment({ id: 4, author: "reviewer", inReplyTo: 3, createdAt: "2026-10-04T00:00:00Z" }),
      comment({ id: 5, author: "me", createdAt: "2026-10-05T00:00:00Z" }),
    );
    expect(newReplyCount(threads, "me")).toBe(2);
  });

  it("returns null when no thread has a new reply", () => {
    const threads = threadsOf(comment({ id: 1, author: "me" }));
    expect(newReplyCount(threads, "me")).toBeNull();
    expect(newReplyCount(threads, null)).toBeNull();
  });
});
