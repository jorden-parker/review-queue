import { describe, expect, it } from "vitest";
import { SessionStore } from "@/lib/session/store";
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
    run(store, { type: "note-add", path: "a.ts", line: 2, kind: "nit", body: " rename " });
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

  it("starts over and drops notes only when asked", () => {
    const store = new SessionStore(":memory:");
    run(store, { type: "step-done", stepId: "s1", done: true });
    run(store, { type: "note-add", path: null, line: null, kind: "parked", body: "later" });
    const kept = run(store, { type: "start-over", keepNotes: true });
    expect(kept.doneSteps).toEqual([]);
    expect(kept.notes).toHaveLength(1);
    expect(run(store, { type: "start-over", keepNotes: false }).notes).toEqual([]);
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
});
