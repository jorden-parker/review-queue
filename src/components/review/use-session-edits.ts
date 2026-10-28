"use client";

import { useCallback } from "react";
import type { ReviewEvent } from "@/lib/github/gh";
import type { SessionAction } from "@/lib/review/session-actions";
import type { Session } from "@/lib/session/store";
import type { Note, NoteTag, PullRequestRef } from "@/lib/types";
import { requestSummaryDraft, sendReply, submitReviewRequest } from "./api";
import type { LineTarget } from "./locate";
import type { OptimisticChange } from "./session-queue";
import { toggled } from "./use-step-navigation";

function withNote(session: Session, note: Omit<Note, "id" | "createdAt">, id: number): Session {
  return { ...session, notes: [...session.notes, { ...note, id, createdAt: "" }] };
}

export function useSessionEdits(
  ref: PullRequestRef,
  headSha: string,
  session: Session,
  act: (action: SessionAction, optimistic?: OptimisticChange) => Promise<void>,
  setSession: (session: Session) => void,
) {
  const toggleHotspot = useCallback(
    (hotspotId: string) => {
      const checked = !session.checkedHotspots.includes(hotspotId);
      act({ type: "hotspot-checked", hotspotId, checked }, (current) => ({
        ...current,
        checkedHotspots: toggled(current.checkedHotspots, hotspotId, checked),
      }));
    },
    [act, session.checkedHotspots],
  );

  const saveNote = useCallback(
    (target: LineTarget | null, tag: NoteTag, body: string) => {
      const note = {
        path: target?.path ?? null,
        line: target?.line ?? null,
        kind: tag.kind,
        decorations: tag.decorations,
        body,
      };
      act({ type: "note-add", ...note }, (current, temporaryNoteId) =>
        withNote(current, note, temporaryNoteId),
      );
    },
    [act],
  );

  const deleteNote = useCallback(
    (id: number) =>
      act({ type: "note-delete", id }, (current) => ({
        ...current,
        notes: current.notes.filter((note) => note.id !== id),
      })),
    [act],
  );

  const editNote = useCallback(
    (id: number, tag: NoteTag, body: string) => {
      const change = { kind: tag.kind, decorations: tag.decorations, body };
      act({ type: "note-edit", id, ...change }, (current) => ({
        ...current,
        notes: current.notes.map((note) => (note.id === id ? { ...note, ...change } : note)),
      }));
    },
    [act],
  );

  const pause = useCallback(
    (note: string) => {
      const at = new Date().toISOString();
      return act({ type: "pause", note }, (current) => ({
        ...current,
        pause: { note, at },
      }));
    },
    [act],
  );

  const resume = useCallback(() => {
    if (session.pause) act({ type: "resume" }, (current) => ({ ...current, pause: null }));
  }, [act, session.pause]);

  const submit = useCallback(
    async (event: ReviewEvent, summary: string, noteIds: number[]) => {
      setSession(await submitReviewRequest(ref, { event, summary, noteIds, headSha }));
    },
    [ref, headSha, setSession],
  );

  const postReply = useCallback(
    async (commentId: number, body: string) => {
      const updated = await sendReply(ref, { commentId, body });
      setSession(updated);
      return updated.replyReceipts[0].replyId;
    },
    [ref, setSession],
  );

  const draftSummary = useCallback(
    async (event: ReviewEvent, noteIds: number[]) => {
      const result = await requestSummaryDraft(ref, headSha, { event, noteIds });
      if (result.status === "ready") return result.summary;
      if (result.status === "error") throw new Error(result.message);
      throw new Error("The local model is switched off");
    },
    [ref, headSha],
  );

  return {
    toggleHotspot,
    saveNote,
    deleteNote,
    editNote,
    pause,
    resume,
    submit,
    postReply,
    draftSummary,
  };
}
