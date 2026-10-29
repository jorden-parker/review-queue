import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ReviewSubmission } from "@/lib/github/gh";
import { sessionStore } from "@/lib/review/services";
import type { FileDiff } from "@/lib/types";

const github = {
  sent: [] as ReviewSubmission[],
  failure: null as string | null,
  head: "sha1",
};

const prepared = { files: [] as FileDiff[] };

vi.mock("@/lib/github/gh", () => ({
  submitReview: async (_ref: unknown, submission: ReviewSubmission) => {
    if (github.failure) throw new Error(github.failure);
    github.sent.push(submission);
    return { id: 42, url: REVIEW_URL };
  },
  getPullRequest: async () => ({ headSha: github.head }),
}));

vi.mock("@/lib/review/prepare", () => ({
  findPrepared: () => Promise.resolve({ data: { files: prepared.files } }),
}));

process.env.REVIEW_QUEUE_DB = ":memory:";

const { POST } = await import("./route");

const KEY = "acme/app#7";
const REVIEW_URL = "https://github.com/acme/app/pull/7#pullrequestreview-42";

function context(number = "7") {
  return { params: Promise.resolve({ owner: "acme", repo: "app", number }) };
}

function request(body: unknown) {
  return new Request("http://test/api", { method: "POST", body: JSON.stringify(body) });
}

function file(path: string, newLines: number[]): FileDiff {
  return {
    path,
    oldPath: path,
    status: "modified",
    binary: false,
    additions: newLines.length,
    deletions: 0,
    hunks: [
      {
        header: "",
        oldStart: 1,
        newStart: newLines[0] ?? 1,
        lines: newLines.map((newLine) => ({ kind: "add", text: "", oldLine: null, newLine })),
      },
    ],
  };
}

const VALID = { event: "COMMENT", summary: "ok", noteIds: [], headSha: "sha1" };

describe("POST submit", () => {
  beforeEach(() => {
    github.sent = [];
    github.failure = null;
    github.head = "sha1";
    prepared.files = [file("a.ts", [2]), file("b.ts", [5])];
  });

  it("rejects bad refs and bodies", async () => {
    expect((await POST(request(VALID), context("x"))).status).toBe(400);
    expect((await POST(request({ event: "NOPE" }), context())).status).toBe(400);
  });

  it("answers 400 for a body that is not JSON", async () => {
    const response = await POST(
      new Request("http://test/api", { method: "POST", body: "{nope" }),
      context(),
    );
    expect(response.status).toBe(400);
    expect(github.sent).toEqual([]);
  });

  it("posts the chosen notes and removes them afterwards", async () => {
    const note = sessionStore().addNote(KEY, {
      side: "new",
      startLine: null,
      path: "a.ts",
      line: 2,
      kind: "nitpick",
      decorations: [],
      body: "rename",
    });
    const response = await POST(request({ ...VALID, noteIds: [note.id] }), context());
    expect(response.status).toBe(200);
    expect(github.sent[0].comments).toEqual([
      { path: "a.ts", line: 2, side: "RIGHT", body: "**nitpick:** rename" },
    ]);
    expect(sessionStore().getSession(KEY).notes).toEqual([]);
  });

  it("posts only the postable notes and keeps a parked note that was chosen with them", async () => {
    const posted = sessionStore().addNote(KEY, {
      side: "new",
      startLine: null,
      path: "a.ts",
      line: 2,
      kind: "nitpick",
      decorations: [],
      body: "rename",
    });
    const parked = sessionStore().addNote(KEY, {
      side: "new",
      startLine: null,
      path: "b.ts",
      line: 5,
      kind: "parked",
      decorations: [],
      body: "private thought",
    });
    const response = await POST(request({ ...VALID, noteIds: [posted.id, parked.id] }), context());
    expect(response.status).toBe(200);
    expect(github.sent[0].comments).toEqual([
      { path: "a.ts", line: 2, side: "RIGHT", body: "**nitpick:** rename" },
    ]);
    const remaining = sessionStore().getSession(KEY).notes;
    expect(remaining.map((note) => note.id)).toEqual([parked.id]);
    sessionStore().deleteNote(KEY, parked.id);
  });

  it("records a receipt with the review link", async () => {
    const response = await POST(request({ ...VALID, summary: "Ship it" }), context());
    const session = await response.json();
    expect(session.submissions[0]).toEqual(
      expect.objectContaining({
        reviewId: 42,
        url: REVIEW_URL,
        event: "COMMENT",
        headSha: "sha1",
        body: "Ship it",
      }),
    );
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

  it("refuses a note whose line is no longer in the diff and names it, without posting", async () => {
    const stale = sessionStore().addNote(KEY, {
      side: "new",
      startLine: null,
      path: "a.ts",
      line: 99,
      kind: "issue",
      decorations: [],
      body: "gone",
    });
    const response = await POST(request({ ...VALID, noteIds: [stale.id] }), context());
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: expect.stringContaining("a.ts:99"),
      noteIds: [stale.id],
    });
    expect(github.sent).toEqual([]);
    expect(sessionStore().getSession(KEY).notes).toHaveLength(1);
    sessionStore().deleteNote(KEY, stale.id);
  });

  it("keeps notes and answers a fixed message when GitHub fails", async () => {
    sessionStore().addNote(KEY, {
      side: "new",
      startLine: null,
      path: null,
      line: null,
      kind: "question",
      decorations: [],
      body: "why?",
    });
    github.failure = "gh api failed: gh: Bad Gateway (HTTP 502)";
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});
    const response = await POST(request(VALID), context());
    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({ error: "GitHub request failed" });
    expect(logged).toHaveBeenCalledOnce();
    logged.mockRestore();
    expect(sessionStore().getSession(KEY).notes).toHaveLength(1);
  });

  it("answers GitHub's 422 as 422 with advice, and keeps the notes", async () => {
    const kept = sessionStore().addNote(KEY, {
      side: "new",
      startLine: null,
      path: null,
      line: null,
      kind: "question",
      decorations: [],
      body: "why?",
    });
    github.failure =
      "gh api repos/acme/app/pulls/7/reviews failed: gh: Validation Failed (HTTP 422)";
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});
    const response = await POST(request(VALID), context());
    expect(response.status).toBe(422);
    expect(await response.json()).toEqual({ error: expect.stringContaining("not in the diff") });
    expect(sessionStore().getSession(KEY).notes).toContainEqual(
      expect.objectContaining({ id: kept.id }),
    );
    logged.mockRestore();
    sessionStore().deleteNote(KEY, kept.id);
  });
});
