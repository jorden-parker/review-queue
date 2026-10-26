import { beforeEach, describe, expect, it } from "vitest";
import { SessionStore } from "./store";
import type { AssistThread } from "@/lib/assist-protocol";

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
    const first = store.addNote(KEY, { path: "a.ts", line: 3, kind: "question", body: "why?" });
    store.addNote(KEY, { path: null, line: null, kind: "parked", body: "look at logging later" });
    expect(store.getSession(KEY).notes.map((note) => note.body)).toEqual([
      "why?",
      "look at logging later",
    ]);
    store.deleteNote(KEY, first.id);
    expect(store.getSession(KEY).notes).toHaveLength(1);
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

  it("remembers checked hotspots", () => {
    store.setHotspotChecked(KEY, "h1", true);
    expect(store.getSession(KEY).checkedHotspots).toEqual(["h1"]);
  });

  it("starts over, keeping notes unless told to drop them", () => {
    store.setCurrentStep(KEY, "s2", "sha1");
    store.setStepDone(KEY, "s1", true);
    store.setHotspotChecked(KEY, "h1", true);
    store.pushJump(KEY, { name: "f", path: "a.ts", line: 1 });
    store.pause(KEY, "next: tests");
    store.addNote(KEY, { path: null, line: null, kind: "parked", body: "later" });
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

  it("summarises progress for many sessions", () => {
    store.setStepDone(KEY, "s1", true);
    store.setCurrentStep(KEY, "s2", "sha1");
    expect(store.progressSummaries([KEY, "other#1"])).toEqual({
      [KEY]: { doneCount: 1, lastHeadSha: "sha1", updatedAt: "2026-10-26T10:00:00.000Z" },
    });
  });
});
