import { describe, expect, it } from "vitest";
import type { SessionAction } from "@/lib/review/session-actions";
import type { Session } from "@/lib/session/store";
import type { Note } from "@/lib/types";
import { emptySession } from "@/test/review-fixture";
import {
  createSerialQueue,
  createTemporaryIds,
  serverIdOfAddedNote,
  settleAnswered,
  settleRefused,
  visibleSession,
  withServerNoteId,
  type SessionLedger,
} from "./session-queue";

type AddedNote = Parameters<typeof serverIdOfAddedNote>[1];

function note(id: number, body: string, overrides: Partial<Note> = {}): Note {
  return {
    side: "new",
    startLine: null,
    id,
    path: null,
    line: null,
    kind: "nitpick",
    decorations: [],
    body,
    createdAt: "",
    ...overrides,
  };
}

function ledger(overrides: Partial<SessionLedger> = {}): SessionLedger {
  return { confirmed: emptySession(), appliedSeq: 0, pending: [], ...overrides };
}

function addedNote(body: string): AddedNote {
  return {
    side: "new",
    startLine: null,
    type: "note-add",
    path: null,
    line: null,
    kind: "nitpick",
    decorations: [],
    body,
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((resolveValue, rejectValue) => {
    resolve = resolveValue;
    reject = rejectValue;
  });
  return { promise, resolve, reject };
}

function settleTurn(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

describe("createSerialQueue", () => {
  it("runs each task after the one before it settles", async () => {
    const queue = createSerialQueue();
    const first = deferred<string>();
    const started: string[] = [];
    const firstRun = queue.run(async () => {
      started.push("first");
      return first.promise;
    });
    const secondRun = queue.run(async () => {
      started.push("second");
      return "second";
    });
    await settleTurn();
    expect(started).toEqual(["first"]);
    first.resolve("first");
    expect(await firstRun).toBe("first");
    expect(await secondRun).toBe("second");
    expect(started).toEqual(["first", "second"]);
  });

  it("keeps running after a task rejects", async () => {
    const queue = createSerialQueue();
    const failing = queue.run(() => Promise.reject(new Error("boom")));
    const following = queue.run(async () => "after");
    await expect(failing).rejects.toThrow("boom");
    expect(await following).toBe("after");
  });
});

describe("createTemporaryIds", () => {
  it("issues distinct negative ids", () => {
    const nextId = createTemporaryIds();
    const ids = [nextId(), nextId(), nextId()];
    expect(new Set(ids).size).toBe(3);
    expect(ids.every((id) => id < 0)).toBe(true);
  });
});

describe("serverIdOfAddedNote", () => {
  it("returns the highest id among notes that match the added note", () => {
    const session = emptySession({ notes: [note(4, "Same"), note(9, "Same")] });
    expect(serverIdOfAddedNote(session, addedNote("Same"))).toBe(9);
  });

  it("matches a body the server trims", () => {
    const session = emptySession({ notes: [note(12, "Same")] });
    expect(serverIdOfAddedNote(session, addedNote("  Same \n"))).toBe(12);
  });

  it("returns null when no note matches", () => {
    const session = emptySession({ notes: [note(3, "Other")] });
    expect(serverIdOfAddedNote(session, addedNote("Same"))).toBeNull();
  });
});

describe("withServerNoteId", () => {
  it("passes through adds and positive ids", () => {
    const add = addedNote("Same");
    const edit: SessionAction = {
      type: "note-edit",
      id: 3,
      kind: "nitpick",
      decorations: [],
      body: "Edited",
    };
    expect(withServerNoteId(add, new Map())).toBe(add);
    expect(withServerNoteId(edit, new Map())).toBe(edit);
  });

  it("rewrites a temporary id to its server id", () => {
    const serverIds = new Map([[-1, 12]]);
    expect(withServerNoteId({ type: "note-delete", id: -1 }, serverIds)).toEqual({
      type: "note-delete",
      id: 12,
    });
  });

  it("returns null for a temporary id with no server id yet", () => {
    expect(withServerNoteId({ type: "note-delete", id: -1 }, new Map())).toBeNull();
  });
});

describe("visibleSession", () => {
  it("is null until a session is confirmed", () => {
    expect(visibleSession(ledger({ confirmed: null }))).toBeNull();
  });

  it("replays pending changes in order on the confirmed session", () => {
    const recordId = (session: Session, temporaryNoteId: number): Session => ({
      ...session,
      checkedHotspots: [...session.checkedHotspots, String(temporaryNoteId)],
    });
    const shown = visibleSession(
      ledger({
        pending: [
          { seq: 1, temporaryNoteId: -1, optimistic: recordId },
          { seq: 2, temporaryNoteId: -2, optimistic: recordId },
        ],
      }),
    );
    expect(shown?.checkedHotspots).toEqual(["-1", "-2"]);
  });
});

describe("settleRefused and settleAnswered", () => {
  it("a refusal removes only its own change", () => {
    const start = ledger({
      pending: [
        { seq: 1, temporaryNoteId: -1 },
        { seq: 2, temporaryNoteId: -2 },
      ],
    });
    const after = settleRefused(start, 1);
    expect(after.pending.map((change) => change.seq)).toEqual([2]);
    expect(after.confirmed).toBe(start.confirmed);
  });

  it("a reply applies its session and removes its change", () => {
    const before = emptySession({ doneSteps: ["a"] });
    const reply = emptySession({ doneSteps: ["b"] });
    const after = settleAnswered(
      ledger({ confirmed: before, pending: [{ seq: 1, temporaryNoteId: -1 }] }),
      1,
      reply,
    );
    expect(after.confirmed).toBe(reply);
    expect(after.appliedSeq).toBe(1);
    expect(after.pending).toEqual([]);
  });

  it("a reply older than the one applied does not overwrite it", () => {
    const start = ledger({
      pending: [
        { seq: 1, temporaryNoteId: -1 },
        { seq: 2, temporaryNoteId: -2 },
      ],
    });
    const newer = emptySession({ doneSteps: ["newer"] });
    const older = emptySession({ doneSteps: ["older"] });
    const afterNewer = settleAnswered(start, 2, newer);
    const afterOlder = settleAnswered(afterNewer, 1, older);
    expect(afterOlder.confirmed).toBe(newer);
    expect(afterOlder.appliedSeq).toBe(2);
    expect(afterOlder.pending).toEqual([]);
  });
});
