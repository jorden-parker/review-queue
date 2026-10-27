import { describe, expect, it } from "vitest";
import type { ReviewComment } from "@/lib/github/gh";
import { threadsAt, threadsFor } from "./conversation-threads";

function comment(overrides: Partial<ReviewComment> & { id: number }): ReviewComment {
  return {
    inReplyTo: null,
    path: "a.ts",
    line: 3,
    side: "RIGHT",
    author: "sam",
    body: "Rename this",
    url: `https://github.com/acme/app/pull/7#discussion_r${overrides.id}`,
    createdAt: "2026-10-01T10:00:00Z",
    ...overrides,
  };
}

describe("threadsFor", () => {
  it("nests replies under their root in the order they were written", () => {
    const threads = threadsFor([
      comment({ id: 2, inReplyTo: 1, body: "Done", createdAt: "2026-10-02T10:00:00Z" }),
      comment({ id: 1, body: "Rename this" }),
      comment({ id: 3, inReplyTo: 1, body: "Thanks", createdAt: "2026-10-03T10:00:00Z" }),
    ]);
    expect(threads).toHaveLength(1);
    expect(threads[0].root.id).toBe(1);
    expect(threads[0].replies.map((reply) => reply.id)).toEqual([2, 3]);
  });

  it("marks a thread outdated when its root no longer sits on a line", () => {
    const threads = threadsFor([comment({ id: 1, line: null })]);
    expect(threads[0].outdated).toBe(true);
  });

  it("does not mark a thread outdated while its root has a line", () => {
    const threads = threadsFor([comment({ id: 1, line: 4 })]);
    expect(threads[0].outdated).toBe(false);
  });

  it("orders threads by when their root was written", () => {
    const threads = threadsFor([
      comment({ id: 5, createdAt: "2026-10-05T10:00:00Z" }),
      comment({ id: 4, createdAt: "2026-10-04T10:00:00Z" }),
    ]);
    expect(threads.map((thread) => thread.root.id)).toEqual([4, 5]);
  });
});

describe("threadsAt", () => {
  it("returns the threads whose root sits on that new-side line", () => {
    const threads = threadsFor([
      comment({ id: 1, line: 3 }),
      comment({ id: 2, line: 4 }),
      comment({ id: 3, path: "b.ts", line: 3 }),
    ]);
    expect(threadsAt(threads, "a.ts", 3).map((thread) => thread.root.id)).toEqual([1]);
  });

  it("ignores threads whose root is on the old side", () => {
    const threads = threadsFor([comment({ id: 1, side: "LEFT", line: 3 })]);
    expect(threadsAt(threads, "a.ts", 3)).toEqual([]);
  });
});
