"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import type { ReviewPayload } from "@/lib/review/prepare";
import type { Session } from "@/lib/session/store";
import type { PullRequestRef } from "@/lib/types";
import { displayHotspots } from "./display-hotspots";
import { firstNoteLine } from "./hunk-index";
import { nextOpenStep, type LineTarget } from "./locate";
import { scrollToElement } from "./scroll-motion";
import type { ShortcutAction } from "./shortcut-keys";
import { type Assist, useAssist } from "./use-assist";
import { useJumps } from "./use-jumps";
import { type LineSelection, useLineSelection } from "./use-line-selection";
import { usePeek } from "./use-peek";
import { useReturnDetection } from "./use-return-detection";
import type { OrientationState, useReview } from "./use-review";
import { useSessionEdits } from "./use-session-edits";
import { useShortcuts } from "./use-shortcuts";
import { useStepNavigation } from "./use-step-navigation";

type Dialog = "resume" | "pause" | "finish" | "help" | "start-over" | null;
export type SidebarTab = "path" | "hotspots" | "notes";

const STALE_SESSION_MS = 30 * 60 * 1000;

export function shouldGreet(review: ReviewPayload, now = Date.now()): boolean {
  const { session } = review;
  if (session.pause || review.reopenedStepIds.length > 0) return true;
  const hasProgress = session.doneSteps.length + session.notes.length > 0;
  const stale =
    session.updatedAt !== null && now - Date.parse(session.updatedAt) > STALE_SESSION_MS;
  return hasProgress && stale;
}

function explainSelection(assist: Assist, selection: LineSelection | null) {
  if (selection) assist.open(selection.range, "explain");
}

function closeTopmost(assist: Assist, closeOthers: () => void) {
  if (assist.thread) assist.close();
  else closeOthers();
}

type ShortcutDeps = {
  review: ReviewPayload;
  ui: ReturnType<typeof useWorkspaceUi>;
  navigation: ReturnType<typeof useStepNavigation>;
  peek: ReturnType<typeof usePeek>;
  jumps: ReturnType<typeof useJumps>;
  assist: Assist;
  selection: LineSelection | null;
};

function shortcutHandlers({
  review,
  ui,
  navigation,
  peek,
  jumps,
  assist,
  selection,
}: ShortcutDeps): Record<ShortcutAction, () => void> {
  const name = ui.getHovered();
  const hoveredFrom = navigation.currentStep?.files[0]?.path ?? "";
  const closePanels = () => {
    ui.setComposer(null);
    peek.close();
    ui.setDialog(null);
  };
  return {
    "next-hunk": () => navigation.moveHunk(1),
    "previous-hunk": () => navigation.moveHunk(-1),
    "next-step": () => navigation.moveStep(1),
    "previous-step": () => navigation.moveStep(-1),
    "done-and-next": navigation.doneAndNext,
    "peek-definition": () => name && jumps.peekName(name, hoveredFrom, 1),
    "peek-references": () => name && peek.showReferences(name, hoveredFrom),
    back: jumps.back,
    note: () => ui.setComposer(firstNoteLine(review.files, navigation.activeHunkId)),
    "ask-model": () => explainSelection(assist, selection),
    park: ui.focusParking,
    "toggle-all": () => navigation.setShowAll((value) => !value),
    pause: () => ui.setDialog("pause"),
    close: () => closeTopmost(assist, closePanels),
    help: () => ui.setDialog("help"),
  };
}

function useWorkspaceUi(review: ReviewPayload) {
  const [dialog, setDialog] = useState<Dialog>(() => (shouldGreet(review) ? "resume" : null));
  const [tab, setTab] = useState<SidebarTab>("path");
  const [composer, setComposer] = useState<LineTarget | null>(null);
  const [breakDue, setBreakDue] = useState(false);
  const [posted, setPosted] = useState(false);
  const hovered = useRef<string | null>(null);
  const parkingInput = useRef<HTMLInputElement>(null);
  const setHovered = useCallback((name: string | null) => {
    hovered.current = name;
  }, []);
  const getHovered = useCallback(() => hovered.current, []);
  const focusParking = useCallback(() => {
    setTab("notes");
    setTimeout(() => parkingInput.current?.focus(), 0);
  }, []);
  return {
    dialog,
    setDialog,
    tab,
    setTab,
    composer,
    setComposer,
    breakDue,
    setBreakDue,
    posted,
    setPosted,
    getHovered,
    setHovered,
    parkingInput,
    focusParking,
  };
}

export function useWorkspace(
  ref: PullRequestRef,
  review: ReviewPayload,
  session: Session,
  orientation: OrientationState,
  controls: ReturnType<typeof useReview>,
) {
  const ui = useWorkspaceUi(review);
  const navigation = useStepNavigation(review, session, controls.act);
  const peek = usePeek(ref, review.headSha);
  const assist = useAssist(ref, review.headSha);
  const selection = useLineSelection();
  const jumps = useJumps(session, controls.act, navigation.goTo, peek);
  const edits = useSessionEdits(ref, review.headSha, session, controls.act, controls.setSession);
  const hotspots = useMemo(
    () => displayHotspots(review.hotspots, orientation),
    [review.hotspots, orientation],
  );
  const startStepId = review.startStepId;
  const files = useMemo(
    () => new Map(review.files.map((file) => [file.path, file])),
    [review.files],
  );
  const linkable = useMemo(() => new Set(review.linkableNames), [review.linkableNames]);
  const nextStep = nextOpenStep(review.steps, session.doneSteps, null);
  const { setDialog, setComposer } = ui;

  useReturnDetection(useCallback(() => setDialog((current) => current ?? "resume"), [setDialog]));

  const resume = useCallback(() => {
    edits.resume();
    setDialog(null);
    const target = review.reopenedStepIds[0] ?? navigation.currentStep?.id ?? nextStep?.id;
    if (target) navigation.selectStep(target);
  }, [edits, navigation, nextStep, review.reopenedStepIds, setDialog]);

  const onShortcut = (action: ShortcutAction) =>
    shortcutHandlers({ review, ui, navigation, peek, jumps, assist, selection })[action]();

  useShortcuts(onShortcut, ui.dialog === null || ui.dialog === "help");

  return {
    ...ui,
    ...navigation,
    aiEnabled: orientation.status !== "disabled",
    ...jumps,
    ...edits,
    peek,
    assist,
    selection,
    hotspots,
    startStepId,
    files,
    linkable,
    nextStep,
    resume,
    saveNote: (
      target: LineTarget | null,
      kind: Parameters<typeof edits.saveNote>[1],
      body: string,
    ) => {
      edits.saveNote(target, kind, body);
      setComposer(null);
    },
    startOver: async (keepNotes: boolean) => {
      setDialog(null);
      await controls.startOver(keepNotes);
      scrollToElement("step-top", "step");
    },
    pause: (note: string) => {
      edits.pause(note);
      setDialog(null);
    },
    submit: async (...args: Parameters<typeof edits.submit>) => {
      await edits.submit(...args);
      ui.setDialog(null);
      ui.setPosted(true);
    },
  };
}
