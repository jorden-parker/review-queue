"use client";

import { useCallback, useEffect, useState } from "react";
import type { OrientationResult } from "@/lib/review/orientation-service";
import type { ReviewPayload } from "@/lib/review/prepare";
import type { SessionAction } from "@/lib/review/session-actions";
import type { Session } from "@/lib/session/store";
import type { PullRequestRef } from "@/lib/types";
import { fetchOrientation, fetchReview, sendSessionAction } from "./api";

type LoadState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; review: ReviewPayload };

export type OrientationState = OrientationResult | { status: "loading" };

function orientationOrError(ref: PullRequestRef, sha: string): Promise<OrientationResult> {
  return fetchOrientation(ref, sha).catch((error: Error) => ({
    status: "error",
    message: error.message,
  }));
}

export function useReview(ref: PullRequestRef) {
  const [load, setLoad] = useState<LoadState>({ status: "loading" });
  const [session, setSession] = useState<Session | null>(null);
  const [orientation, setOrientation] = useState<OrientationState>({ status: "loading" });
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchReview(ref)
      .then((review) => {
        if (cancelled) return;
        setLoad({ status: "ready", review });
        setSession(review.session);
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
    async (action: SessionAction, optimistic?: (session: Session) => Session) => {
      if (optimistic) setSession((current) => (current ? optimistic(current) : current));
      try {
        setSession(await sendSessionAction(ref, action));
        setActionError(null);
      } catch (error) {
        setActionError(error instanceof Error ? error.message : String(error));
      }
    },
    [ref],
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

  return { load, session, setSession, orientation, act, actionError, startOver };
}
