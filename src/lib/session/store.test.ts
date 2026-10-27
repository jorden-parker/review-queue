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

describe("SessionStore", () => {
  let store: SessionStore;
  let now: number;

  beforeEach(() => {
    now = Date.parse("2026-10-26T10:00:00Z");
    store = new SessionStore(":memory:", () => new Date(now));
  });

  it("starts empty and records the step you are on", () => {
    expect(store.getSession(KEY)).toMatchObject({ currentStepId: null, doneSteps: [], notes: [] });
    store.setCurrentStep(KEY, "s2", "sha1");
    expect(store.getSession(KEY)).toMatchObject({ currentStepId: "s2", lastHeadSha: "sha1" });
  });

  it("remembers the last head commit seen", () => {
    store.markSeen(KEY, "sha9");
    expect(store.getSession(KEY).lastHeadSha).toBe("sha9");
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
    store.setCurrentStep(KEY, "s2", "sha1");
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
    store.setCurrentStep(KEY, "s2", "sha1");
    expect(store.progressSummaries([KEY, "other#1"])).toEqual({
      [KEY]: {
        doneCount: 1,
        noteCount: 0,
        lastHeadSha: "sha1",
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
});
