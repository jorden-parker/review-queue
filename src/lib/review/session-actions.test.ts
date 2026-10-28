import { describe, expect, it } from "vitest";
import { SessionStore } from "@/lib/session/store";
import { NOTE_LABELS } from "@/lib/types";
import { applySessionAction, SessionActionSchema } from "./session-actions";

const KEY = "acme/app#1";
const HEAD_SHA = "a".repeat(40);

function run(store: SessionStore, raw: unknown) {
  return applySessionAction(store, KEY, SessionActionSchema.parse(raw));
}

describe("applySessionAction", () => {
  it("applies each action and returns the new session", () => {
    const store = new SessionStore(":memory:");
    run(store, { type: "current-step", stepId: "s1", headSha: HEAD_SHA });
    run(store, { type: "step-done", stepId: "s1", done: true });
    run(store, { type: "hotspot-checked", hotspotId: "h1", checked: true });
    run(store, {
      type: "note-add",
      path: "a.ts",
      line: 2,
      kind: "nitpick",
      decorations: [],
      body: " rename ",
    });
    run(store, { type: "jump-push", name: "f", path: "a.ts", line: 1 });
    run(store, { type: "jump-push", name: "g", path: "b.ts", line: 1 });
    run(store, { type: "jump-pop" });
    const session = run(store, { type: "pause", note: "next: tests" });
    expect(session).toMatchObject({
      currentStepId: "s1",
      doneSteps: ["s1"],
      checkedHotspots: ["h1"],
      jumps: [{ name: "f" }],
      pause: { note: "next: tests" },
    });
    expect(session.notes[0].body).toBe("rename");
    expect(run(store, { type: "resume" }).pause).toBeNull();
    expect(run(store, { type: "note-delete", id: session.notes[0].id }).notes).toEqual([]);
    expect(run(store, { type: "jump-clear" }).jumps).toEqual([]);
  });

  it("edits a note's kind, decorations and body", () => {
    const store = new SessionStore(":memory:");
    const added = run(store, {
      type: "note-add",
      path: null,
      line: null,
      kind: "nitpick",
      decorations: [],
      body: "typo",
    });
    const id = added.notes[0].id;
    const session = run(store, {
      type: "note-edit",
      id,
      kind: "issue",
      decorations: ["blocking"],
      body: " leaks ",
    });
    expect(session.notes[0]).toMatchObject({
      id,
      kind: "issue",
      decorations: ["blocking"],
      body: "leaks",
    });
    expect(() =>
      run(store, { type: "note-edit", id, kind: "nitpick", decorations: [], body: "  " }),
    ).toThrow();
  });

  it("stores any label with decorations and rejects the old blocker label", () => {
    const store = new SessionStore(":memory:");
    const session = run(store, {
      type: "note-add",
      path: null,
      line: null,
      kind: "suggestion",
      decorations: ["non-blocking", "if-minor"],
      body: "extract a helper",
    });
    expect(session.notes[0]).toMatchObject({
      kind: "suggestion",
      decorations: ["non-blocking", "if-minor"],
    });
    expect(() =>
      run(store, {
        type: "note-add",
        path: null,
        line: null,
        kind: "blocker",
        decorations: [],
        body: "x",
      }),
    ).toThrow();
  });

  it("rejects contradictory blocking decorations", () => {
    const store = new SessionStore(":memory:");
    expect(() =>
      run(store, {
        type: "note-add",
        path: null,
        line: null,
        kind: "issue",
        decorations: ["blocking", "non-blocking"],
        body: "x",
      }),
    ).toThrow();
  });

  it("offers the twelve Conventional Comments labels in order", () => {
    expect(NOTE_LABELS).toEqual([
      "praise",
      "nitpick",
      "suggestion",
      "issue",
      "todo",
      "question",
      "thought",
      "chore",
      "note",
      "typo",
      "polish",
      "quibble",
    ]);
  });

  it("saves, updates and deletes model chats", () => {
    const store = new SessionStore(":memory:");
    const thread = {
      id: "6f1c8f9e-1d2b-4c3a-9e8f-7a6b5c4d3e2f",
      headSha: HEAD_SHA,
      target: { kind: "file", path: "src/a.ts" },
      action: "explain",
      question: null,
      turns: [
        { role: "reviewer", text: "Explain this file" },
        { role: "model", text: "It loads." },
      ],
    };
    run(store, { type: "assist-save", thread });
    const turns = [...thread.turns, { role: "reviewer", text: "Why?" }];
    const saved = run(store, { type: "assist-save", thread: { ...thread, turns } });
    expect(saved.assistThreads).toEqual([expect.objectContaining({ ...thread, turns })]);
    expect(run(store, { type: "assist-delete", id: thread.id }).assistThreads).toEqual([]);
  });

  it("saves the lookups a model turn made, and rejects an unreasonable number of them", () => {
    const store = new SessionStore(":memory:");
    const lookup = { tool: "find_references", label: "Callers of `a` (1)", paths: ["src/b.ts"] };
    const thread = {
      id: "6f1c8f9e-1d2b-4c3a-9e8f-7a6b5c4d3e2f",
      headSha: HEAD_SHA,
      target: { kind: "file", path: "src/a.ts" },
      action: "explain",
      question: null,
      turns: [
        { role: "reviewer", text: "Explain this file" },
        { role: "model", text: "It loads.", lookups: [lookup] },
      ],
    };
    const saved = run(store, { type: "assist-save", thread });
    expect(saved.assistThreads).toEqual([expect.objectContaining({ turns: thread.turns })]);
    const many = Array.from({ length: 30 }, () => lookup);
    expect(() =>
      SessionActionSchema.parse({
        type: "assist-save",
        thread: {
          ...thread,
          turns: [thread.turns[0], { role: "model", text: "x", lookups: many }],
        },
      }),
    ).not.toThrow();
    const flood = Array.from({ length: 501 }, () => lookup);
    expect(() =>
      SessionActionSchema.parse({
        type: "assist-save",
        thread: {
          ...thread,
          turns: [thread.turns[0], { role: "model", text: "x", lookups: flood }],
        },
      }),
    ).toThrow();
  });

  it("rejects a chat with an unknown target or too many turns", () => {
    const thread = {
      id: "6f1c8f9e-1d2b-4c3a-9e8f-7a6b5c4d3e2f",
      headSha: HEAD_SHA,
      target: { kind: "folder", path: "src" },
      action: "explain",
      question: null,
      turns: [],
    };
    expect(() => SessionActionSchema.parse({ type: "assist-save", thread })).toThrow();
    const turns = Array.from({ length: 40 }, () => ({ role: "model", text: "x" }));
    const file = { kind: "file", path: "src/a.ts" };
    expect(() =>
      SessionActionSchema.parse({
        type: "assist-save",
        thread: { ...thread, target: file, turns },
      }),
    ).toThrow();
  });

  it("records seen symbols and pins them", () => {
    const store = new SessionStore(":memory:");
    const symbol = {
      name: "load",
      kind: "parameter",
      path: "src/a.ts",
      line: 3,
      scope: "file",
      signature: "(parameter) load: number",
      stepId: "s1",
      origin: { name: "load", path: "src/a.ts", line: 5, character: 4, side: "new" },
    };
    run(store, { type: "symbol-seen", symbol });
    const session = run(store, { type: "symbol-pin", symbol, pinned: true });
    expect(session.contextSymbols).toEqual([expect.objectContaining({ ...symbol, pinned: true })]);
    expect(() => run(store, { type: "symbol-seen", symbol: { ...symbol, kind: "x" } })).toThrow();
  });

  it("starts over and drops notes only when asked", () => {
    const store = new SessionStore(":memory:");
    run(store, { type: "step-done", stepId: "s1", done: true });
    run(store, {
      type: "note-add",
      path: null,
      line: null,
      kind: "parked",
      decorations: [],
      body: "later",
    });
    const kept = run(store, { type: "start-over", keepNotes: true });
    expect(kept.doneSteps).toEqual([]);
    expect(kept.notes).toHaveLength(1);
    expect(run(store, { type: "start-over", keepNotes: false }).notes).toEqual([]);
  });

  it("catches up on a moved head by clearing the baseline", () => {
    const store = new SessionStore(":memory:");
    store.markSeen(KEY, "sha1");
    store.markSeen(KEY, "sha2");
    expect(run(store, { type: "catch-up" }).baselineHeadSha).toBeNull();
  });

  it("rejects malformed actions", () => {
    expect(() => SessionActionSchema.parse({ type: "note-add", body: "" })).toThrow();
    expect(() => SessionActionSchema.parse({ type: "explode" })).toThrow();
  });

  it("accepts only a full commit id as the head", () => {
    const step = { type: "current-step", stepId: "s1" };
    expect(() => SessionActionSchema.parse({ ...step, headSha: "--output=/tmp/x" })).toThrow();
    expect(() => SessionActionSchema.parse({ ...step, headSha: "abc" })).toThrow();
    expect(SessionActionSchema.parse({ ...step, headSha: "b".repeat(64) })).toBeTruthy();
  });

  it("does not let a stale tab's step rewind the head seen", () => {
    const store = new SessionStore(":memory:");
    store.markSeen(KEY, "b".repeat(40));
    run(store, { type: "current-step", stepId: "s1", headSha: HEAD_SHA });
    expect(store.getSession(KEY).lastHeadSha).toBe("b".repeat(40));
  });

  it("archives a session and restores it", () => {
    const store = new SessionStore(":memory:");
    run(store, { type: "step-done", stepId: "s1", done: true });
    run(store, { type: "archive" });
    expect(store.inProgress()).toEqual([]);
    expect(store.archived()).toEqual([expect.objectContaining({ key: KEY })]);
    run(store, { type: "unarchive" });
    expect(store.archived()).toEqual([]);
    expect(store.inProgress()).toEqual([expect.objectContaining({ key: KEY })]);
  });
});
