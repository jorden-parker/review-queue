import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ReviewSubmission } from "@/lib/github/gh";
import { sessionStore } from "@/lib/review/services";

const github = {
  sent: [] as ReviewSubmission[],
  failure: null as string | null,
  head: "sha1",
};

vi.mock("@/lib/github/gh", () => ({
  submitReview: async (_ref: unknown, submission: ReviewSubmission) => {
    if (github.failure) throw new Error(github.failure);
    github.sent.push(submission);
  },
  getPullRequest: async () => ({ headSha: github.head }),
}));

process.env.REVIEW_QUEUE_DB = ":memory:";

const { POST } = await import("./route");

const KEY = "acme/app#7";

function context(number = "7") {
  return { params: Promise.resolve({ owner: "acme", repo: "app", number }) };
}

function request(body: unknown) {
  return new Request("http://test/api", { method: "POST", body: JSON.stringify(body) });
}

const VALID = { event: "COMMENT", summary: "ok", noteIds: [], headSha: "sha1" };

describe("POST submit", () => {
  beforeEach(() => {
    github.sent = [];
    github.failure = null;
    github.head = "sha1";
  });

  it("rejects bad refs and bodies", async () => {
    expect((await POST(request(VALID), context("x"))).status).toBe(400);
    expect((await POST(request({ event: "NOPE" }), context())).status).toBe(400);
  });

  it("posts the chosen notes and removes them afterwards", async () => {
    const note = sessionStore().addNote(KEY, {
      path: "a.ts",
      line: 2,
      kind: "nitpick",
      decorations: [],
      body: "rename",
    });
    const response = await POST(request({ ...VALID, noteIds: [note.id] }), context());
    expect(response.status).toBe(200);
    expect(github.sent[0].comments).toEqual([
      { path: "a.ts", line: 2, body: "**nitpick:** rename" },
    ]);
    expect(sessionStore().getSession(KEY).notes).toEqual([]);
  });

  it("refuses when the head moved since the review was loaded", async () => {
    github.head = "sha2";
    const response = await POST(request(VALID), context());
    expect(response.status).toBe(409);
    expect(github.sent).toEqual([]);
  });

  it("refuses a second submit after the head moved, even though the first one posted", async () => {
    expect((await POST(request(VALID), context())).status).toBe(200);
    github.head = "sha2";
    const response = await POST(request(VALID), context());
    expect(response.status).toBe(409);
    expect(github.sent).toHaveLength(1);
  });

  it("keeps notes and reports the error when GitHub fails", async () => {
    sessionStore().addNote(KEY, {
      path: null,
      line: null,
      kind: "question",
      decorations: [],
      body: "why?",
    });
    github.failure = "gh: 422";
    const response = await POST(request(VALID), context());
    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({ error: "gh: 422" });
    expect(sessionStore().getSession(KEY).notes).toHaveLength(1);
  });
});
