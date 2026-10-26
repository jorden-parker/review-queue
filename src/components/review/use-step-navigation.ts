"use client";

import { useCallback, useLayoutEffect, useMemo, useState } from "react";
import type { ReviewPayload } from "@/lib/review/prepare";
import type { SessionAction } from "@/lib/review/session-actions";
import type { Session } from "@/lib/session/store";
import { hunkIdsFor } from "./hunk-index";
import { lineElementId, nextOpenStep, stepForLine, type LineTarget } from "./locate";
import { scrollToElement, type ScrollKind } from "./scroll-motion";

export type Act = (
  action: SessionAction,
  optimistic?: (session: Session) => Session,
) => Promise<void>;

export function toggled(list: string[], value: string, on: boolean): string[] {
  return on ? [...new Set([...list, value])] : list.filter((item) => item !== value);
}

export function useStepNavigation(review: ReviewPayload, session: Session, act: Act) {
  const [showAll, setShowAll] = useState(false);
  const [activeHunk, setActiveHunk] = useState(0);
  const [scrollRequest, setScrollRequest] = useState<{ id: string; kind: ScrollKind } | null>(null);

  const currentStepId = session.currentStepId ?? review.startStepId;
  const found = review.steps.findIndex((step) => step.id === currentStepId);
  const currentIndex = Math.max(0, found);
  const currentStep = review.steps[currentIndex] ?? null;
  const visibleSteps = useMemo(
    () => (showAll ? review.steps : currentStep ? [currentStep] : []),
    [showAll, review.steps, currentStep],
  );
  const hunkIds = useMemo(() => hunkIdsFor(visibleSteps), [visibleSteps]);
  const activeHunkId = hunkIds[Math.min(activeHunk, hunkIds.length - 1)] ?? null;

  useLayoutEffect(() => {
    if (scrollRequest) scrollToElement(scrollRequest.id, scrollRequest.kind);
  }, [scrollRequest]);

  const selectStep = useCallback(
    (stepId: string, scrollTarget = "step-top", kind: ScrollKind = "step") => {
      act({ type: "current-step", stepId, headSha: review.headSha }, (current) => ({
        ...current,
        currentStepId: stepId,
      }));
      setActiveHunk(0);
      setScrollRequest({ id: scrollTarget, kind });
    },
    [act, review.headSha],
  );

  const goTo = useCallback(
    (target: LineTarget) => {
      const step = stepForLine(review.steps, review.files, target);
      if (step) selectStep(step.id, lineElementId(target), "line");
    },
    [review.steps, review.files, selectStep],
  );

  const setStepDone = useCallback(
    (stepId: string, done: boolean) =>
      act({ type: "step-done", stepId, done }, (current) => ({
        ...current,
        doneSteps: toggled(current.doneSteps, stepId, done),
      })),
    [act],
  );

  const doneAndNext = useCallback(() => {
    if (!currentStep) return;
    setStepDone(currentStep.id, true);
    const next = nextOpenStep(review.steps, [...session.doneSteps, currentStep.id], currentStep.id);
    if (next) selectStep(next.id);
  }, [currentStep, review.steps, selectStep, session.doneSteps, setStepDone]);

  const moveStep = useCallback(
    (offset: number) => {
      const target = review.steps[currentIndex + offset];
      if (target) selectStep(target.id);
    },
    [currentIndex, review.steps, selectStep],
  );

  const moveHunk = useCallback(
    (offset: number) => {
      const next = Math.max(0, Math.min(hunkIds.length - 1, activeHunk + offset));
      setActiveHunk(next);
      if (hunkIds[next]) scrollToElement(hunkIds[next], "hunk");
    },
    [activeHunk, hunkIds],
  );

  return {
    showAll,
    setShowAll,
    currentStep,
    currentIndex,
    visibleSteps,
    activeHunkId,
    selectStep,
    goTo,
    setStepDone,
    doneAndNext,
    moveStep,
    moveHunk,
  };
}
