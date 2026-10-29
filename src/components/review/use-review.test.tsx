import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SessionAction } from "@/lib/review/session-actions";
import type { Session } from "@/lib/session/store";
import type { Note } from "@/lib/types";
import { REF, emptySession, reviewPayload } from "@/test/review-fixture";
import { fetchOrientation, fetchReview, postSeen, sendSessionAction } from "./api";
import { useReview } from "./use-review";

vi.mock("./api", () => ({
  fetchReview: vi.fn(),
  fetchOrientation: vi.fn(),
  postSeen: vi.fn(),
  sendSessionAction: vi.fn(),
}));

const OTHER_REF = { ...REF, number: 8 };

function note(id: number, body: string): Note {
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
  };
}

function noteAdd(body: string): SessionAction {
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

function withNoteAdded(body: string) {
  return (session: Session, temporaryNoteId: number): Session => ({
    ...session,
    notes: [...session.notes, note(temporaryNoteId, body)],
  });
}

function withHotspotChecked(hotspot: string) {
  return (session: Session): Session => ({
    ...session,
    checkedHotspots: [...session.checkedHotspots, hotspot],
  });
}

function onlyNote(session: Session | null): Note {
  const [first] = session?.notes ?? [];
  if (!first) throw new Error("expected a note on screen");
  return first;
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

async function renderLoadedHook() {
  vi.mocked(fetchReview).mockResolvedValue(reviewPayload());
  vi.mocked(fetchOrientation).mockResolvedValue({ status: "disabled" });
  vi.mocked(postSeen).mockResolvedValue({ session: reviewPayload().session, reopenedStepIds: [] });
  const hook = renderHook(({ pr }) => useReview(pr), { initialProps: { pr: REF } });
  await waitFor(() => expect(hook.result.current.session).not.toBeNull());
  return hook;
}

describe("useReview session changes", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("rolls back a refused change and shows why", async () => {
    const { result } = await renderLoadedHook();
    vi.mocked(sendSessionAction).mockRejectedValueOnce(new Error("Note body is too long"));

    await act(() =>
      result.current.act(noteAdd("Needs a default"), withNoteAdded("Needs a default")),
    );

    expect(result.current.session?.notes).toEqual([]);
    expect(result.current.actionError).toBe("Note body is too long");
  });

  it("keeps a later change on screen after an earlier one is refused", async () => {
    const { result } = await renderLoadedHook();
    const laterAnswer = deferred<Session>();
    vi.mocked(sendSessionAction)
      .mockRejectedValueOnce(new Error("nope"))
      .mockReturnValueOnce(laterAnswer.promise);

    let firstDone!: Promise<void>;
    let laterDone!: Promise<void>;
    act(() => {
      firstDone = result.current.act(
        { type: "hotspot-checked", hotspotId: "a", checked: true },
        withHotspotChecked("a"),
      );
      laterDone = result.current.act(
        { type: "hotspot-checked", hotspotId: "b", checked: true },
        withHotspotChecked("b"),
      );
    });
    await waitFor(() => expect(result.current.actionError).toBe("nope"));
    expect(result.current.session?.checkedHotspots).toEqual(["b"]);

    await act(async () => {
      laterAnswer.resolve(emptySession({ checkedHotspots: ["b"] }));
      await Promise.all([firstDone, laterDone]);
    });
  });

  it("sends an edit with the server id once the add answers, one request at a time", async () => {
    const { result } = await renderLoadedHook();
    const addAnswer = deferred<Session>();
    vi.mocked(sendSessionAction)
      .mockReturnValueOnce(addAnswer.promise)
      .mockResolvedValueOnce(emptySession({ notes: [note(5, "Edited")] }));

    let addDone!: Promise<void>;
    let editDone!: Promise<void>;
    act(() => {
      addDone = result.current.act(noteAdd("Needs a default"), withNoteAdded("Needs a default"));
    });
    const temporaryId = onlyNote(result.current.session).id;
    expect(temporaryId).toBeLessThan(0);
    act(() => {
      editDone = result.current.act({
        type: "note-edit",
        id: temporaryId,
        kind: "nitpick",
        decorations: [],
        body: "Edited",
      });
    });
    await waitFor(() => expect(sendSessionAction).toHaveBeenCalledTimes(1));
    await act(async () => {});
    expect(sendSessionAction).toHaveBeenCalledTimes(1);

    await act(async () => {
      addAnswer.resolve(emptySession({ notes: [note(5, "Needs a default")] }));
      await addDone;
    });
    await waitFor(() => expect(sendSessionAction).toHaveBeenCalledTimes(2));
    expect(vi.mocked(sendSessionAction).mock.calls[1][1]).toEqual({
      type: "note-edit",
      id: 5,
      kind: "nitpick",
      decorations: [],
      body: "Edited",
    });
    await act(() => editDone);
    expect(result.current.session?.notes[0].body).toBe("Edited");
  });

  it("sends nothing for a note whose add was refused", async () => {
    const { result } = await renderLoadedHook();
    const addAnswer = deferred<Session>();
    vi.mocked(sendSessionAction).mockReturnValueOnce(addAnswer.promise);

    let addDone!: Promise<void>;
    let deleteDone!: Promise<void>;
    act(() => {
      addDone = result.current.act(noteAdd("Needs a default"), withNoteAdded("Needs a default"));
    });
    const temporaryId = onlyNote(result.current.session).id;
    act(() => {
      deleteDone = result.current.act({ type: "note-delete", id: temporaryId });
    });

    await act(async () => {
      addAnswer.reject(new Error("Note body is too long"));
      await Promise.all([addDone, deleteDone]);
    });
    await waitFor(() =>
      expect(result.current.actionError).toBe("the note it changes was never saved"),
    );
    expect(sendSessionAction).toHaveBeenCalledTimes(1);
    expect(result.current.session?.notes).toEqual([]);
  });

  it("does not let a reply for the previous PR replace the one now open", async () => {
    vi.mocked(fetchReview).mockImplementation(async (ref) =>
      reviewPayload(
        ref.number === OTHER_REF.number
          ? emptySession({ doneSteps: ["other-pr"] })
          : emptySession(),
      ),
    );
    vi.mocked(fetchOrientation).mockResolvedValue({ status: "disabled" });
    vi.mocked(postSeen).mockImplementation(async (ref) => ({
      session:
        ref.number === OTHER_REF.number
          ? emptySession({ doneSteps: ["other-pr"] })
          : emptySession(),
      reopenedStepIds: [],
    }));
    const { result, rerender } = renderHook(({ pr }) => useReview(pr), {
      initialProps: { pr: REF },
    });
    await waitFor(() => expect(result.current.session).not.toBeNull());

    const stepAnswer = deferred<Session>();
    vi.mocked(sendSessionAction).mockReturnValueOnce(stepAnswer.promise);
    let stepDone!: Promise<void>;
    act(() => {
      stepDone = result.current.act({
        type: "step-done",
        stepId: "types:src/types.ts:0",
        done: true,
      });
    });
    rerender({ pr: OTHER_REF });
    await waitFor(() => expect(result.current.session?.doneSteps).toEqual(["other-pr"]));

    await act(async () => {
      stepAnswer.resolve(emptySession({ doneSteps: ["types:src/types.ts:0"] }));
      await stepDone;
    });
    await act(async () => {});
    expect(result.current.session?.doneSteps).toEqual(["other-pr"]);
  });
});
