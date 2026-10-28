import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { beforeEach, describe, expect, it } from "vitest";
import type { AssistThread } from "@/lib/assist-protocol";
import { SessionStore, type SeenSymbol } from "./store";

const KEY = "acme/app#7";

function thread(id: string, text = "It loads."): AssistThread {
  return {
    id,
    headSha: "sha1",
    target: { kind: "file", path: "src/a.ts" },
    action: "explain",
    question: null,
    turns: [
      { role: "reviewer", text: "Explain this file" },
      { role: "model", text },
    ],
  };
}

function symbol(name: string, line = 1): SeenSymbol {
  return {
    name,
    kind: "function",
    path: "src/a.ts",
    line,
    scope: "repo",
    signature: `function ${name}()`,
    stepId: "s1",
    origin: { name, path: "src/b.ts", line: 7, character: 2, side: "new" },
  };
}

function withTempDirectory(run: (directory: string) => void): void {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "rq-store-"));
  try {
    run(directory);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
}

function countRows(file: string, table: string): number {
  const check = new DatabaseSync(file);
  try {
    return (check.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get() as { n: number }).n;
  } finally {
    check.close();
  }
}

describe("SessionStore", () => {
  let store: SessionStore;
  let now: number;

  beforeEach(() => {
    now = Date.parse("2026-10-26T10:00:00Z");
    store = new SessionStore(":memory:", () => new Date(now));
  });

  it("starts empty and records the step you are on", () => {
    expect(store.getSession(KEY)).toMatchObject({ currentStepId: null, doneSteps: [], notes: [] });
    store.setCurrentStep(KEY, "s2");
    expect(store.getSession(KEY)).toMatchObject({ currentStepId: "s2", lastHeadSha: null });
  });

  it("remembers the last head commit seen", () => {
    store.markSeen(KEY, "sha9");
    expect(store.getSession(KEY).lastHeadSha).toBe("sha9");
  });

  it("keeps the head you had seen as the baseline when a push arrives", () => {
    store.markSeen(KEY, "sha1");
    store.markSeen(KEY, "sha2");
    expect(store.getSession(KEY)).toMatchObject({ baselineHeadSha: "sha1", lastHeadSha: "sha2" });
  });

  it("does not move the baseline on a second push", () => {
    store.markSeen(KEY, "sha1");
    store.markSeen(KEY, "sha2");
    store.markSeen(KEY, "sha3");
    expect(store.getSession(KEY)).toMatchObject({ baselineHeadSha: "sha1", lastHeadSha: "sha3" });
  });

  it("forgets the baseline on catch-up", () => {
    store.markSeen(KEY, "sha1");
    store.markSeen(KEY, "sha2");
    store.catchUp(KEY);
    expect(store.getSession(KEY).baselineHeadSha).toBeNull();
  });

  it("first load sets no baseline", () => {
    store.markSeen(KEY, "sha1");
    expect(store.getSession(KEY).baselineHeadSha).toBeNull();
  });

  it("clears the baseline when start over runs", () => {
    store.markSeen(KEY, "sha1");
    store.markSeen(KEY, "sha2");
    store.startOver(KEY, true);
    expect(store.getSession(KEY).baselineHeadSha).toBeNull();
  });

  it("reopens a finished review when the head moves", () => {
    store.rememberTitle(KEY, "Add retry");
    store.markSeen(KEY, "sha1");
    store.addNote(KEY, { path: null, line: null, kind: "nitpick", decorations: [], body: "x" });
    store.markFinished(KEY);
    store.markSeen(KEY, "sha1");
    expect(store.inProgress()).toEqual([]);
    store.markSeen(KEY, "sha2");
    expect(store.inProgress()).toEqual([expect.objectContaining({ key: KEY, title: "Add retry" })]);
  });

  it("marks steps done and undone", () => {
    store.setStepDone(KEY, "s1", true);
    store.setStepDone(KEY, "s2", true);
    store.setStepDone(KEY, "s1", false);
    expect(store.getSession(KEY).doneSteps).toEqual(["s2"]);
  });

  it("keeps notes in creation order and deletes them", () => {
    const first = store.addNote(KEY, {
      path: "a.ts",
      line: 3,
      kind: "question",
      decorations: [],
      body: "why?",
    });
    store.addNote(KEY, {
      path: null,
      line: null,
      kind: "parked",
      decorations: [],
      body: "look at logging later",
    });
    expect(store.getSession(KEY).notes.map((note) => note.body)).toEqual([
      "why?",
      "look at logging later",
    ]);
    store.deleteNote(KEY, first.id);
    expect(store.getSession(KEY).notes).toHaveLength(1);
  });

  it("edits a note's body and kind, leaving its place alone", () => {
    const note = store.addNote(KEY, {
      path: "a.ts",
      line: 3,
      kind: "nitpick",
      decorations: [],
      body: "rename",
    });
    store.updateNote(KEY, note.id, {
      kind: "issue",
      decorations: ["blocking"],
      body: "this leaks",
    });
    expect(store.getSession(KEY).notes).toEqual([
      { ...note, kind: "issue", decorations: ["blocking"], body: "this leaks" },
    ]);
    store.updateNote("other#1", note.id, { kind: "nitpick", decorations: [], body: "ignored" });
    expect(store.getSession(KEY).notes[0].body).toBe("this leaks");
  });

  it("stores a note's decorations and returns exactly the note's fields", () => {
    const note = store.addNote(KEY, {
      path: "a.ts",
      line: 3,
      kind: "issue",
      decorations: ["blocking"],
      body: "leaks",
    });
    expect(Object.keys(note).sort()).toEqual([
      "body",
      "createdAt",
      "decorations",
      "id",
      "kind",
      "line",
      "path",
    ]);
    expect(store.getSession(KEY).notes[0]).toMatchObject({ decorations: ["blocking"] });
  });

  it("migrates old blocker and nit notes in a file database and leaves them alone afterwards", () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "rq-store-"));
    const file = path.join(directory, "review-queue.db");
    try {
      const legacy = new DatabaseSync(file);
      legacy.exec(`CREATE TABLE IF NOT EXISTS notes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        pr_key TEXT NOT NULL,
        path TEXT,
        line INTEGER,
        kind TEXT NOT NULL,
        body TEXT NOT NULL,
        created_at TEXT NOT NULL
      )`);
      const insert = legacy.prepare(
        "INSERT INTO notes (pr_key, path, line, kind, body, created_at) VALUES (?, ?, ?, ?, ?, ?)",
      );
      insert.run(KEY, "a.ts", 1, "blocker", "leaks", "2026-10-26T10:00:00Z");
      insert.run(KEY, "a.ts", 2, "nit", "rename", "2026-10-26T10:01:00Z");
      insert.run(KEY, "a.ts", 3, "question", "why?", "2026-10-26T10:02:00Z");
      legacy.close();

      const migrated = new SessionStore(file);
      expect(
        migrated.getSession(KEY).notes.map(({ kind, decorations }) => ({ kind, decorations })),
      ).toEqual([
        { kind: "issue", decorations: ["blocking"] },
        { kind: "nitpick", decorations: [] },
        { kind: "question", decorations: [] },
      ]);

      const again = new SessionStore(file);
      expect(
        again.getSession(KEY).notes.map(({ kind, decorations }) => ({ kind, decorations })),
      ).toEqual([
        { kind: "issue", decorations: ["blocking"] },
        { kind: "nitpick", decorations: [] },
        { kind: "question", decorations: [] },
      ]);
    } finally {
      fs.rmSync(directory, { recursive: true, force: true });
    }
  });

  it("pauses with a note and clears it on resume", () => {
    store.pause(KEY, "check the retry loop next");
    expect(store.getSession(KEY).pause).toEqual({
      note: "check the retry loop next",
      at: "2026-10-26T10:00:00.000Z",
    });
    store.resume(KEY);
    expect(store.getSession(KEY).pause).toBeNull();
  });

  it("tracks a jump trail as a stack", () => {
    store.pushJump(KEY, { name: "load", path: "a.ts", line: 4 });
    store.pushJump(KEY, { name: "parse", path: "b.ts", line: 9 });
    expect(store.popJump(KEY)).toEqual({ name: "parse", path: "b.ts", line: 9 });
    expect(store.getSession(KEY).jumps).toEqual([{ name: "load", path: "a.ts", line: 4 }]);
    store.clearJumps(KEY);
    expect(store.popJump(KEY)).toBeNull();
  });

  it("remembers seen and pinned symbols, newest first, keeping the pin on revisit", () => {
    store.recordSymbolSeen(KEY, symbol("load"));
    now += 1000;
    store.recordSymbolSeen(KEY, symbol("parse", 9));
    store.setSymbolPinned(KEY, symbol("load"), true);
    now += 1000;
    store.recordSymbolSeen(KEY, { ...symbol("load"), stepId: "s2" });
    expect(store.getSession(KEY).contextSymbols).toEqual([
      { ...symbol("load"), stepId: "s2", pinned: true, seenAt: "2026-10-26T10:00:02.000Z" },
      { ...symbol("parse", 9), pinned: false, seenAt: "2026-10-26T10:00:01.000Z" },
    ]);
    store.setSymbolPinned(KEY, symbol("load"), false);
    expect(store.getSession(KEY).contextSymbols[0].pinned).toBe(false);
  });

  it("keeps only the newest unpinned symbols but never drops a pin", () => {
    store.setSymbolPinned(KEY, symbol("kept", 0), true);
    for (let line = 1; line <= 60; line += 1) {
      now += 1000;
      store.recordSymbolSeen(KEY, symbol(`s${line}`, line));
    }
    const symbols = store.getSession(KEY).contextSymbols;
    expect(symbols).toHaveLength(51);
    expect(symbols.some((entry) => entry.name === "kept")).toBe(true);
    expect(symbols.some((entry) => entry.name === "s10")).toBe(false);
  });

  it("remembers checked hotspots", () => {
    store.setHotspotChecked(KEY, "h1", true);
    expect(store.getSession(KEY).checkedHotspots).toEqual(["h1"]);
  });

  it("starts over, keeping notes unless told to drop them", () => {
    store.setCurrentStep(KEY, "s2");
    store.setStepDone(KEY, "s1", true);
    store.setHotspotChecked(KEY, "h1", true);
    store.pushJump(KEY, { name: "f", path: "a.ts", line: 1 });
    store.recordSymbolSeen(KEY, symbol("f"));
    store.pause(KEY, "next: tests");
    store.addNote(KEY, { path: null, line: null, kind: "parked", decorations: [], body: "later" });
    store.saveAssistThread(KEY, thread("t1"));
    store.setStepDone("other#1", "s1", true);
    store.startOver(KEY, true);
    expect(store.getSession(KEY)).toMatchObject({
      currentStepId: null,
      lastHeadSha: null,
      updatedAt: null,
      pause: null,
      doneSteps: [],
      checkedHotspots: [],
      jumps: [],
      contextSymbols: [],
      notes: [{ body: "later" }],
      assistThreads: [{ id: "t1" }],
    });
    store.startOver(KEY, false);
    expect(store.getSession(KEY).notes).toEqual([]);
    expect(store.getSession(KEY).assistThreads).toEqual([]);
    expect(store.getSession("other#1").doneSteps).toEqual(["s1"]);
  });

  it("saves model chats, newest first, and updates them in place", () => {
    store.saveAssistThread(KEY, thread("t1"));
    now += 1000;
    store.saveAssistThread(KEY, thread("t2"));
    now += 1000;
    store.saveAssistThread(KEY, thread("t1", "It loads twice."));
    const saved = store.getSession(KEY).assistThreads;
    expect(saved.map((chat) => chat.id)).toEqual(["t1", "t2"]);
    expect(saved[0]).toEqual({
      ...thread("t1", "It loads twice."),
      updatedAt: "2026-10-26T10:00:02.000Z",
    });
  });

  it("keeps each PR's chats apart", () => {
    store.saveAssistThread(KEY, thread("t1"));
    store.saveAssistThread("other#1", thread("t1", "Other."));
    expect(store.getSession(KEY).assistThreads[0].turns[1].text).toBe("It loads.");
  });

  it("deletes a model chat", () => {
    store.saveAssistThread(KEY, thread("t1"));
    store.deleteAssistThread(KEY, "t1");
    expect(store.getSession(KEY).assistThreads).toEqual([]);
  });

  it("caches values by key", () => {
    expect(store.getCached("k")).toBeNull();
    store.setCached("k", '{"a":1}');
    expect(store.getCached("k")).toBe('{"a":1}');
  });

  it("keeps settings apart from the cache and overwrites them", () => {
    store.setCached("llm", "cached");
    expect(store.getSetting("llm")).toBeNull();
    store.setSetting("llm", '{"a":1}');
    store.setSetting("llm", '{"a":2}');
    expect(store.getSetting("llm")).toBe('{"a":2}');
  });

  it("summarises progress for many sessions", () => {
    store.setStepDone(KEY, "s1", true);
    store.setCurrentStep(KEY, "s2");
    expect(store.progressSummaries([KEY, "other#1"])).toEqual({
      [KEY]: {
        doneCount: 1,
        noteCount: 0,
        lastHeadSha: null,
        updatedAt: "2026-10-26T10:00:00.000Z",
        pause: null,
      },
    });
  });

  it("includes the pause note in the summary", () => {
    store.pause(KEY, "about to read the tests");
    expect(store.progressSummaries([KEY])[KEY]?.pause).toEqual({
      note: "about to read the tests",
      at: "2026-10-26T10:00:00.000Z",
    });
  });

  it("adds the title and finished columns to a database created before them", () => {
    const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "review-queue-")), "old.db");
    const old = new DatabaseSync(file);
    old.exec(
      "CREATE TABLE sessions (pr_key TEXT PRIMARY KEY, current_step TEXT, head_sha TEXT, pause_note TEXT, paused_at TEXT, updated_at TEXT NOT NULL)",
    );
    old.close();
    const upgraded = new SessionStore(file);
    upgraded.rememberTitle(KEY, "Add retry");
    expect(upgraded.inProgress()).toEqual([]);
  });

  it("remembers the PR title and lists sessions with progress that are not finished", () => {
    store.rememberTitle(KEY, "Add retry");
    store.setStepDone(KEY, "s1", true);
    store.rememberTitle("acme/app#8", "Only opened");
    store.rememberTitle("acme/app#9", "Posted");
    store.addNote("acme/app#9", {
      path: null,
      line: null,
      kind: "nitpick",
      decorations: [],
      body: "x",
    });
    store.markFinished("acme/app#9");
    expect(store.inProgress()).toEqual([
      {
        key: KEY,
        title: "Add retry",
        doneCount: 1,
        pauseNote: null,
        updatedAt: "2026-10-26T10:00:00.000Z",
      },
    ]);
  });

  it("keeps a receipt of each posted review, newest first", () => {
    const submission = {
      reviewId: 1,
      url: "https://github.com/acme/app/pull/7#pullrequestreview-1",
      event: "COMMENT" as const,
      headSha: "sha1",
      body: "first",
    };
    store.recordSubmission(KEY, submission);
    now += 1000;
    store.recordSubmission(KEY, { ...submission, reviewId: 2, body: "second" });
    expect(store.getSession(KEY).submissions).toEqual([
      {
        reviewId: 2,
        url: submission.url,
        event: "COMMENT",
        headSha: "sha1",
        body: "second",
        postedAt: "2026-10-26T10:00:01.000Z",
      },
      {
        reviewId: 1,
        url: submission.url,
        event: "COMMENT",
        headSha: "sha1",
        body: "first",
        postedAt: "2026-10-26T10:00:00.000Z",
      },
    ]);
  });

  it("keeps receipts across start over", () => {
    store.recordSubmission(KEY, {
      reviewId: 1,
      url: "https://github.com/acme/app/pull/7#pullrequestreview-1",
      event: "APPROVE",
      headSha: "sha1",
      body: "",
    });
    store.setStepDone(KEY, "s1", true);
    store.startOver(KEY, false);
    expect(store.getSession(KEY).doneSteps).toEqual([]);
    expect(store.getSession(KEY).submissions).toHaveLength(1);
  });

  it("keeps reply receipts newest first with the comment they answer", () => {
    const reply = {
      parentCommentId: 5,
      url: "https://github.com/acme/app/pull/7#discussion_r77",
    };
    store.recordReply(KEY, { replyId: 77, ...reply, body: "Thanks" });
    now += 1000;
    store.recordReply(KEY, { replyId: 78, ...reply, body: "Thanks again" });
    expect(store.getSession(KEY).replyReceipts).toEqual([
      {
        replyId: 78,
        parentCommentId: 5,
        url: reply.url,
        body: "Thanks again",
        postedAt: "2026-10-26T10:00:01.000Z",
      },
      {
        replyId: 77,
        parentCommentId: 5,
        url: reply.url,
        body: "Thanks",
        postedAt: "2026-10-26T10:00:00.000Z",
      },
    ]);
  });

  it("keeps reply receipts across start over", () => {
    store.recordReply(KEY, {
      replyId: 77,
      parentCommentId: 5,
      url: "https://github.com/acme/app/pull/7#discussion_r77",
      body: "Thanks",
    });
    store.setStepDone(KEY, "s1", true);
    store.startOver(KEY, false);
    expect(store.getSession(KEY).replyReceipts).toHaveLength(1);
  });

  it("indexes the per-PR tables that have no primary key starting with pr_key", () => {
    withTempDirectory((directory) => {
      const file = path.join(directory, "review-queue.db");
      new SessionStore(file);
      const check = new DatabaseSync(file);
      const indexes = check
        .prepare("SELECT name FROM sqlite_master WHERE type = 'index'")
        .all() as { name: string }[];
      check.close();
      expect(indexes.map((index) => index.name)).toEqual(
        expect.arrayContaining(["notes_pr_key", "jumps_pr_key", "submissions_pr_key"]),
      );
    });
  });

  it("opens the database in write-ahead logging mode", () => {
    withTempDirectory((directory) => {
      const file = path.join(directory, "review-queue.db");
      new SessionStore(file);
      const check = new DatabaseSync(file);
      expect(check.prepare("PRAGMA journal_mode").get()).toEqual({ journal_mode: "wal" });
      check.close();
    });
  });

  it("keeps a new database file and its directory private to the user", () => {
    withTempDirectory((directory) => {
      const dataDirectory = path.join(directory, "data");
      const file = path.join(dataDirectory, "review-queue.db");
      new SessionStore(file);
      expect(fs.statSync(file).mode & 0o777).toBe(0o600);
      expect(fs.statSync(dataDirectory).mode & 0o777).toBe(0o700);
    });
  });

  it("tightens a database file that was created world-readable", () => {
    withTempDirectory((directory) => {
      const file = path.join(directory, "review-queue.db");
      fs.writeFileSync(file, "");
      fs.chmodSync(file, 0o644);
      new SessionStore(file);
      expect(fs.statSync(file).mode & 0o777).toBe(0o600);
    });
  });

  it("leaves every table untouched when a start over fails part way", () => {
    withTempDirectory((directory) => {
      const file = path.join(directory, "review-queue.db");
      const fileStore = new SessionStore(file, () => new Date(now));
      fileStore.setStepDone(KEY, "s1", true);
      fileStore.pushJump(KEY, { name: "f", path: "a.ts", line: 1 });
      fileStore.addNote(KEY, {
        path: null,
        line: null,
        kind: "parked",
        decorations: [],
        body: "later",
      });
      const broken = new DatabaseSync(file);
      broken.exec("DROP TABLE context_symbols");
      broken.close();
      expect(() => fileStore.startOver(KEY, false)).toThrow();
      expect(countRows(file, "done_steps")).toBe(1);
      expect(countRows(file, "jumps")).toBe(1);
      expect(countRows(file, "notes")).toBe(1);
    });
  });

  it("setting the step records it without touching the head seen", () => {
    store.markSeen(KEY, "sha1");
    store.setCurrentStep(KEY, "s2");
    expect(store.getSession(KEY)).toMatchObject({ currentStepId: "s2", lastHeadSha: "sha1" });
  });

  it("archives a session out of the in-progress list and restores it", () => {
    store.rememberTitle(KEY, "Add retry");
    store.setStepDone(KEY, "s1", true);
    store.archive(KEY);
    expect(store.inProgress()).toEqual([]);
    expect(store.archived()).toEqual([
      expect.objectContaining({ key: KEY, title: "Add retry", doneCount: 1 }),
    ]);
    store.unarchive(KEY);
    expect(store.inProgress()).toEqual([expect.objectContaining({ key: KEY })]);
    expect(store.archived()).toEqual([]);
  });

  it("keeps an archived session's steps, notes and updated time", () => {
    store.setStepDone(KEY, "s1", true);
    store.addNote(KEY, { path: null, line: null, kind: "nitpick", decorations: [], body: "x" });
    now = Date.parse("2026-10-26T11:00:00Z");
    store.archive(KEY);
    expect(store.archived()[0].updatedAt).toBe("2026-10-26T10:00:00.000Z");
    expect(store.getSession(KEY).doneSteps).toEqual(["s1"]);
    expect(store.getSession(KEY).notes).toHaveLength(1);
  });

  it("brings an archived session back when its head moves, but not on the same head", () => {
    store.markSeen(KEY, "sha1");
    store.setStepDone(KEY, "s1", true);
    store.archive(KEY);
    store.markSeen(KEY, "sha1");
    expect(store.inProgress()).toEqual([]);
    store.markSeen(KEY, "sha2");
    expect(store.inProgress()).toEqual([expect.objectContaining({ key: KEY })]);
    expect(store.archived()).toEqual([]);
  });

  it("keeps a finished session out of both lists", () => {
    store.setStepDone(KEY, "s1", true);
    store.archive(KEY);
    store.markFinished(KEY);
    expect(store.archived()).toEqual([]);
    expect(store.inProgress()).toEqual([]);
  });

  it("adds the archived column once, to a database created before it", () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "review-queue-"));
    const file = path.join(directory, "before-archive.db");
    const old = new DatabaseSync(file);
    old.exec(
      "CREATE TABLE sessions (pr_key TEXT PRIMARY KEY, current_step TEXT, head_sha TEXT, pause_note TEXT, paused_at TEXT, updated_at TEXT NOT NULL, title TEXT, finished_at TEXT)",
    );
    old.exec(
      "INSERT INTO sessions (pr_key, updated_at, pause_note) VALUES ('acme/app#7', '2026-10-26T10:00:00.000Z', 'later')",
    );
    old.close();
    const upgraded = new SessionStore(file);
    expect(upgraded.inProgress()).toEqual([expect.objectContaining({ key: KEY })]);
    upgraded.archive(KEY);
    expect(new SessionStore(file).archived()).toEqual([expect.objectContaining({ key: KEY })]);
  });
});
