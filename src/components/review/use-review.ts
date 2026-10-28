"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { OrientationResult } from "@/lib/review/orientation-service";
import type { ReviewPayload, SeenResult } from "@/lib/review/prepare";
import type { SessionAction } from "@/lib/review/session-actions";
import type { Session } from "@/lib/session/store";
import { prKey } from "@/lib/pr-ref";
import type { PullRequestRef } from "@/lib/types";
import { fetchOrientation, fetchReview, postSeen, sendSessionAction } from "./api";
import {
  createSerialQueue,
  createTemporaryIds,
  serverIdOfAddedNote,
  settleAnswered,
  settleRefused,
  visibleSession,
  withServerNoteId,
  type OptimisticChange,
  type SessionLedger,
} from "./session-queue";

type LoadState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; review: ReviewPayload };

export type OrientationState = OrientationResult | { status: "loading" };

const UNSAVED_NOTE_MESSAGE = "the note it changes was never saved";

function orientationOrError(ref: PullRequestRef, sha: string): Promise<OrientationResult> {
  return fetchOrientation(ref, sha).catch((error: Error) => ({
    status: "error",
    message: error.message,
  }));
}

export function useReview(ref: PullRequestRef) {
  const [load, setLoad] = useState<LoadState>({ status: "loading" });
  const [ledger, setLedger] = useState<SessionLedger>({
    confirmed: null,
    appliedSeq: 0,
    pending: [],
  });
  const session = useMemo(() => visibleSession(ledger), [ledger]);
  const [orientation, setOrientation] = useState<OrientationState>({ status: "loading" });
  const [actionError, setActionError] = useState<string | null>(null);
  const [queue] = useState(createSerialQueue);
  const [nextTemporaryId] = useState(createTemporaryIds);
  const [serverIds] = useState(() => new Map<number, number>());
  const sequence = useRef(0);
  const epoch = useRef(0);
  const seenRequests = useRef(new Map<string, Promise<SeenResult>>());

  useEffect(() => {
    let cancelled = false;
    epoch.current += 1;
    const seenOnce = (sha: string) => {
      const requests = seenRequests.current;
      const key = `${prKey(ref)}@${sha}`;
      if (!requests.has(key)) requests.set(key, postSeen(ref, sha));
      return requests.get(key)!;
    };
    fetchReview(ref)
      .then((review) => seenOnce(review.headSha).then((seen) => ({ review, seen })))
      .then(({ review, seen }) => {
        if (cancelled) return;
        setLoad({
          status: "ready",
          review: { ...review, session: seen.session, reopenedStepIds: seen.reopenedStepIds },
        });
        setLedger({ confirmed: seen.session, appliedSeq: 0, pending: [] });
        return orientationOrError(ref, review.headSha);
      })
      .then((result) => {
        if (!cancelled && result) setOrientation(result);
      })
      .catch((error: Error) => {
        if (!cancelled) setLoad({ status: "error", message: error.message });
      });
    return () => {
      cancelled = true;
    };
  }, [ref]);

  const act = useCallback(
    (action: SessionAction, optimistic?: OptimisticChange) => {
      const seq = ++sequence.current;
      const epochAtDispatch = epoch.current;
      const temporaryNoteId = nextTemporaryId();
      const isCurrent = () => epochAtDispatch === epoch.current;
      setLedger((current) => ({
        ...current,
        pending: [...current.pending, { seq, temporaryNoteId, optimistic }],
      }));
      return queue.run(async () => {
        const sent = withServerNoteId(action, serverIds);
        if (!sent) {
          if (isCurrent()) {
            setLedger((current) => settleRefused(current, seq));
            setActionError(UNSAVED_NOTE_MESSAGE);
          }
          return;
        }
        try {
          const answer = await sendSessionAction(ref, sent);
          if (action.type === "note-add") {
            const serverId = serverIdOfAddedNote(answer, action);
            if (serverId !== null) serverIds.set(temporaryNoteId, serverId);
          }
          if (isCurrent()) {
            setLedger((current) => settleAnswered(current, seq, answer));
            setActionError(null);
          }
        } catch (error) {
          if (isCurrent()) {
            setLedger((current) => settleRefused(current, seq));
            setActionError(error instanceof Error ? error.message : String(error));
          }
        }
      });
    },
    [ref, queue, nextTemporaryId, serverIds],
  );

  const replaceSession = useCallback(
    (next: Session) => setLedger((current) => ({ ...current, confirmed: next })),
    [],
  );

  const startOver = useCallback(
    async (keepNotes: boolean) => {
      await act({ type: "start-over", keepNotes });
      setLoad((current) =>
        current.status === "ready"
          ? { status: "ready", review: { ...current.review, reopenedStepIds: [] } }
          : current,
      );
    },
    [act],
  );

  return {
    load,
    session,
    setSession: replaceSession,
    orientation,
    act,
    actionError,
    startOver,
  };
}
