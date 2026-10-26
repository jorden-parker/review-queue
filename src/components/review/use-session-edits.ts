"use client";

import { useCallback } from "react";
import type { ReviewEvent } from "@/lib/github/gh";
import type { Session } from "@/lib/session/store";
import type { Note, NoteKind, PullRequestRef } from "@/lib/types";
import { submitReviewRequest } from "./api";
import type { LineTarget } from "./locate";
import { toggled, type Act } from "./use-step-navigation";

function withNote(session: Session, note: Omit<Note, "id" | "createdAt">): Session {
  return { ...session, notes: [...session.notes, { ...note, id: -Date.now(), createdAt: "" }] };
}

export function useSessionEdits(
  ref: PullRequestRef,
  headSha: string,
  session: Session,
  act: Act,
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
    (target: LineTarget | null, kind: NoteKind, body: string) => {
      const note = { path: target?.path ?? null, line: target?.line ?? null, kind, body };
      act({ type: "note-add", ...note }, (current) => withNote(current, note));
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

  const pause = useCallback(
    (note: string) =>
      act({ type: "pause", note }, (current) => ({
        ...current,
        pause: { note, at: new Date().toISOString() },
      })),
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

  return { toggleHotspot, saveNote, deleteNote, pause, resume, submit };
}
