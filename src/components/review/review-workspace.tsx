"use client";

import {
  ArrowLeft,
  ArrowRight,
  CircleHelp,
  Coffee,
  Compass,
  Flame,
  Layers,
  ListTree,
  type LucideIcon,
  MapPin,
  MessagesSquare,
  RotateCcw,
  Route,
  Send,
  Shapes,
  Sparkles,
  StickyNote,
} from "lucide-react";
import Link from "next/link";
import { useMemo } from "react";
import { Callout } from "@/components/common/callout";
import { EmptyState } from "@/components/common/empty-state";
import { HintButton } from "@/components/common/hint-button";
import { InlineMarkdown } from "@/components/common/markdown-text";
import { Button } from "@/components/ui/button";
import { Kbd } from "@/components/ui/kbd";
import {
  type AssistTarget,
  targetCommentLine,
  targetFirstLine,
  targetLabel,
  targetPath,
} from "@/lib/assist-protocol";
import { prKey } from "@/lib/pr-ref";
import { cn } from "cn";
import type { PreparedFile, ReviewPayload } from "@/lib/review/prepare";
import type { Session } from "@/lib/session/store";
import type { PullRequestRef, Step } from "@/lib/types";
import { AssistPanel } from "./assist-panel";
import { citationsInText, parseCitation } from "./citations";
import { FinishReview } from "./finish-review";
import { FocusTimer } from "./focus-timer";
import { ContextList } from "./context-list";
import { contextCount } from "./context-symbols";
import { HotspotList } from "./hotspot-list";
import { JumpTrail } from "./jump-trail";
import { NotesPanel } from "./notes-panel";
import { OrientationCard } from "./orientation-card";
import { PauseDialog } from "./pause-dialog";
import { PeekPanel } from "./peek-panel";
import { PostedToast } from "./posted-toast";
import { ORDERING_MESSAGE, ReadingPath } from "./reading-path";
import { ResumeCard } from "./resume-card";
import { ShortcutHelp } from "./shortcut-help";
import { StartOverDialog } from "./start-over-dialog";
import { occurrencesOf } from "./occurrences";
import { orderedSteps, stepReasons } from "./step-order";
import { SavedChatsPanel } from "./saved-chats-panel";
import { SelectionToolbar } from "./selection-toolbar";
import { useReferenceCounts } from "./use-file-symbols";
import { WorkspaceOutline } from "./workspace-outline";
import { StepSummary } from "./step-summary";
import { StepView, type StepViewContext } from "./step-view";
import { useReview, type OrientationState } from "./use-review";
import { useWorkspace, type Workspace } from "./use-workspace";
import { PANE_SIDES, type PaneId, type PanelSide } from "./pane-layout";
import { type PaneContent, type PaneEntry, ReviewPanel, type SideControls } from "./review-panel";
import { usePanelSizings } from "./use-panel-width";

type WorkspaceProps = {
  pullRequest: PullRequestRef;
  review: ReviewPayload;
  session: Session;
  orientation: OrientationState;
  controls: ReturnType<typeof useReview>;
};

const PANES: { id: PaneId; label: string; icon: LucideIcon }[] = [
  { id: "about", label: "About", icon: Compass },
  { id: "step", label: "Step", icon: MapPin },
  { id: "path", label: "Path", icon: Route },
  { id: "hotspots", label: "Hotspots", icon: Flame },
  { id: "notes", label: "Notes", icon: StickyNote },
  { id: "chat", label: "Chat", icon: Sparkles },
  { id: "chats", label: "Chats", icon: MessagesSquare },
  { id: "context", label: "Context", icon: Shapes },
  { id: "outline", label: "Outline", icon: ListTree },
];

function TopBar({ review, workspace }: { review: ReviewPayload; workspace: Workspace }) {
  return (
    <header className="flex h-14 items-center gap-2 border-b bg-background pr-2 pl-1.5 sm:gap-4 sm:pr-4 sm:pl-4.5">
      <HintButton
        variant="ghost"
        size="icon"
        hint="Back to inbox"
        aria-label="Back to inbox"
        asChild
      >
        <Link href="/">
          <ArrowLeft />
        </Link>
      </HintButton>
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-base/tight font-bold">
          <InlineMarkdown text={review.pr.title} />
        </span>
        <span className="flex min-w-0 gap-2 truncate text-xs text-muted-foreground">
          <span>{prKey(review.pr.ref)}</span>
          <span>by {review.pr.author}</span>
          <span className="font-mono max-sm:hidden">{review.headSha.slice(0, 7)}</span>
        </span>
      </div>
      <div className="flex shrink-0 items-center gap-0.5 sm:gap-1">
        <FocusTimer onFinished={() => workspace.setBreakDue(true)} />
        <span aria-hidden className="mx-1 h-5 w-px bg-border max-sm:hidden" />
        <HintButton
          variant="ghost"
          size="icon"
          hint="Start over"
          aria-label="Start over"
          onClick={() => workspace.setDialog("start-over")}
        >
          <RotateCcw />
        </HintButton>
        <HintButton
          variant="ghost"
          size="icon"
          hint="Keyboard shortcuts"
          shortcut="?"
          aria-label="Keyboard shortcuts"
          className="max-sm:hidden"
          onClick={() => workspace.setDialog("help")}
        >
          <CircleHelp />
        </HintButton>
        <HintButton
          variant="outline"
          hint="Pause with a note"
          shortcut="."
          className="ml-1"
          onClick={() => workspace.setDialog("pause")}
        >
          <Coffee /> <span className="max-sm:sr-only">Pause</span>
        </HintButton>
        <Button onClick={() => workspace.setDialog("finish")}>
          <Send /> <span className="max-sm:sr-only">Finish</span>
        </Button>
      </div>
    </header>
  );
}

type PaneProps = {
  review: ReviewPayload;
  session: Session;
  workspace: Workspace;
  orientation: OrientationState;
  fresh: boolean;
};

function paneEntries({ session, workspace }: PaneProps, side: PanelSide): PaneEntry[] {
  const openHotspots = workspace.hotspots.filter(
    (hotspot) => !session.checkedHotspots.includes(hotspot.id),
  ).length;
  const counts: Record<PaneId, number | null> = {
    about: null,
    step: null,
    path: null,
    hotspots: openHotspots,
    notes: session.notes.length,
    chat: null,
    chats: session.assistThreads.length,
    context: contextCount(session.contextSymbols, workspace.currentStep?.id ?? null),
    outline: null,
  };
  return PANES.filter(
    (pane) => PANE_SIDES[pane.id] === side && (workspace.aiEnabled || pane.id !== "chat"),
  ).map((pane) => ({ ...pane, count: counts[pane.id] }));
}

function sideControls(workspace: Workspace, side: PanelSide): SideControls {
  return {
    togglePanel: () => workspace.togglePanel(side),
    pickPane: workspace.pickPane,
    splitPane: workspace.splitPane,
    closePane: workspace.closePane,
    dropPane: workspace.dropPane,
  };
}

function WorkspacePanel({
  side,
  sizing,
  ...props
}: PaneProps & { side: PanelSide; sizing: ReturnType<typeof usePanelSizings>["left"] }) {
  return (
    <ReviewPanel
      side={side}
      entries={paneEntries(props, side)}
      panes={props.workspace.panes[side]}
      controls={sideControls(props.workspace, side)}
      sizing={sizing}
      renderPane={(id) => PANE_CONTENT[id](props)}
    />
  );
}

function PathPane({ review, session, workspace, orientation }: PaneProps) {
  return (
    <ReadingPath
      steps={review.steps}
      startStepId={workspace.startStepId}
      currentStepId={workspace.currentStep?.id ?? null}
      doneSteps={session.doneSteps}
      reopenedStepIds={review.reopenedStepIds}
      reasons={stepReasons(orientation)}
      ordering={orientation.status === "loading"}
      fallback={orientation.status === "error"}
      onSelect={(stepId) => workspace.selectStep(stepId)}
      onToggleDone={(stepId) => workspace.setStepDone(stepId, !session.doneSteps.includes(stepId))}
    />
  );
}

function HotspotsPane({ session, workspace }: PaneProps) {
  return (
    <HotspotList
      hotspots={workspace.hotspots}
      checked={session.checkedHotspots}
      onOpen={(hotspot) => workspace.goTo({ path: hotspot.path, line: hotspot.line ?? 1 })}
      onToggleChecked={workspace.toggleHotspot}
    />
  );
}

function NotesPane({ session, workspace }: PaneProps) {
  return (
    <NotesPanel
      notes={session.notes}
      parkingRef={workspace.parkingInput}
      onPark={(body) => workspace.saveNote(null, "parked", body)}
      onOpen={(note) => note.path && workspace.goTo({ path: note.path, line: note.line ?? 1 })}
      onEdit={workspace.editNote}
      onDelete={workspace.deleteNote}
    />
  );
}

function chatPane({ workspace }: PaneProps): PaneContent {
  if (workspace.assist.thread) {
    return { body: <WorkspaceAssist workspace={workspace} />, ownHeader: true };
  }
  return {
    body: (
      <EmptyState emoji="💬">
        No chat open. Select lines and press <Kbd>i</Kbd>, or open a saved chat.
      </EmptyState>
    ),
  };
}

function ChatsPane({ review, session, workspace }: PaneProps) {
  return (
    <SavedChatsPanel
      chats={session.assistThreads}
      headSha={review.headSha}
      labelOf={(chat) => labelFor(workspace, chat.target)}
      onOpen={workspace.assist.reopen}
      onDelete={(chatId) => {
        if (workspace.assist.thread?.id === chatId) workspace.assist.close();
        workspace.deleteSavedChat(chatId);
      }}
    />
  );
}

function ContextPane({ session, workspace }: PaneProps) {
  if (workspace.peek.peek) return <WorkspacePeek workspace={workspace} />;
  return (
    <ContextList
      symbols={session.contextSymbols}
      stepId={workspace.currentStep?.id ?? null}
      jumps={session.jumps}
      onOpen={(symbol) => workspace.peekName(symbol.origin)}
      onTogglePin={(symbol) => workspace.setSymbolPinned(symbol, !symbol.pinned)}
      onBack={workspace.back}
      onClearTrail={workspace.clearJumps}
    />
  );
}

function OutlinePane({ review, workspace }: PaneProps) {
  return (
    <WorkspaceOutline
      pullRequest={workspace.pullRequest}
      headSha={review.headSha}
      step={workspace.currentStep ?? null}
      files={workspace.files}
      onGoTo={workspace.goTo}
      onPeek={workspace.peekName}
    />
  );
}

const PANE_CONTENT: Record<PaneId, (props: PaneProps) => PaneContent> = {
  about: (props) => ({
    body: <OrientationCard key={props.fresh ? "fresh" : "started"} {...props} />,
  }),
  step: (props) => ({ body: <StepSummary {...props} /> }),
  path: (props) => ({ body: <PathPane {...props} /> }),
  hotspots: (props) => ({ body: <HotspotsPane {...props} /> }),
  notes: (props) => ({ body: <NotesPane {...props} /> }),
  chat: chatPane,
  chats: (props) => ({ body: <ChatsPane {...props} /> }),
  context: (props) => ({ body: <ContextPane {...props} /> }),
  outline: (props) => ({ body: <OutlinePane {...props} /> }),
};

function StepTrack({ steps, currentIndex, doneSteps }: StepTrackProps) {
  return (
    <ol aria-hidden className="flex gap-1">
      {steps.map((step, index) => (
        <li
          key={step.id}
          className={cn(
            "h-1.5 flex-1 rounded-full bg-border transition-colors duration-calm",
            doneSteps.includes(step.id) && "bg-primary",
            index === currentIndex && "bg-marker",
          )}
        />
      ))}
    </ol>
  );
}

type StepTrackProps = { steps: Step[]; currentIndex: number; doneSteps: string[] };

function StepBar({
  review,
  session,
  workspace,
}: {
  review: ReviewPayload;
  session: Session;
  workspace: Workspace;
}) {
  const step = workspace.currentStep;
  if (!step) return null;
  const isLast = workspace.currentIndex >= review.steps.length - 1;
  return (
    <div className="flex flex-col gap-3">
      <StepTrack
        steps={review.steps}
        currentIndex={workspace.showAll ? -1 : workspace.currentIndex}
        doneSteps={session.doneSteps}
      />
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <h2 className="flex min-w-48 flex-1 items-baseline gap-3 truncate">
          <span className="shrink-0 text-sm text-muted-foreground tabular-nums">
            {workspace.currentIndex + 1} of {review.steps.length}
          </span>
          <span className="truncate text-lg font-bold">
            {workspace.showAll ? "Whole PR" : step.title}
          </span>
        </h2>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="ghost"
            onClick={() => workspace.setShowAll(!workspace.showAll)}
            className="text-muted-foreground"
          >
            <Layers />
            <span className="max-sm:sr-only">
              {workspace.showAll ? "Back to one step at a time" : "Show whole PR"}
            </span>
            <Kbd className="max-sm:hidden">a</Kbd>
          </Button>
          {!workspace.showAll && (
            <>
              <Button
                variant="outline"
                onClick={() => workspace.moveStep(-1)}
                disabled={workspace.currentIndex <= 0}
              >
                <ArrowLeft /> <span className="max-sm:sr-only">Previous</span>
                <Kbd className="max-sm:hidden">p</Kbd>
              </Button>
              <Button onClick={workspace.doneAndNext}>
                {isLast ? "Done with this step" : "Done, next step"} <ArrowRight />
                <Kbd className="bg-primary-foreground/20 text-primary-foreground max-sm:hidden">
                  x
                </Kbd>
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function BreakBanner({ workspace }: { workspace: Workspace }) {
  if (!workspace.breakDue) return null;
  return (
    <Callout className="animate-step-enter flex flex-wrap items-center justify-between gap-3">
      <span className="flex items-center gap-2">
        <Coffee className="size-4 shrink-0" />
        25 minutes of focus. Nice. Take five? Leave yourself a note first.
      </span>
      <span className="flex gap-2">
        <Button size="sm" variant="secondary" onClick={() => workspace.setDialog("pause")}>
          Pause with a note
        </Button>
        <Button size="sm" variant="ghost" onClick={() => workspace.setBreakDue(false)}>
          Keep going
        </Button>
      </span>
    </Callout>
  );
}

function Dialogs({
  review,
  session,
  workspace,
}: {
  review: ReviewPayload;
  session: Session;
  workspace: Workspace;
}) {
  const close = () => workspace.setDialog(null);
  switch (workspace.dialog) {
    case "resume":
      return (
        <ResumeCard
          session={session}
          steps={review.steps}
          nextStep={workspace.nextStep}
          reopenedCount={review.reopenedStepIds.length}
          onContinue={workspace.resume}
        />
      );
    case "pause":
      return <PauseDialog onPause={workspace.pause} onCancel={close} />;
    case "finish":
      return (
        <FinishReview
          notes={session.notes}
          stepsLeft={review.steps.length - session.doneSteps.length}
          hotspotsLeft={
            workspace.hotspots.filter((hotspot) => !session.checkedHotspots.includes(hotspot.id))
              .length
          }
          onSubmit={workspace.submit}
          onDraftSummary={workspace.aiEnabled ? workspace.draftSummary : undefined}
          onCancel={close}
        />
      );
    case "help":
      return <ShortcutHelp onClose={close} />;
    case "start-over":
      return (
        <StartOverDialog
          noteCount={session.notes.length}
          onStartOver={workspace.startOver}
          onCancel={close}
        />
      );
    default:
      return null;
  }
}

function WorkspacePeek({ workspace }: { workspace: Workspace }) {
  const { peek } = workspace.peek;
  if (!peek) return null;
  return (
    <PeekPanel
      peek={peek}
      inPullRequest={(path) => workspace.files.has(path)}
      onIdentifier={workspace.peekName}
      onGoTo={workspace.goToFromPeek}
      pinned={workspace.peekPinned}
      onTogglePin={workspace.togglePeekPin}
      onTab={(tab) => {
        if (tab === "references") workspace.peek.showReferences(peek.position);
        else workspace.peek.showDefinitions(peek.position);
      }}
      onClose={workspace.peek.close}
    />
  );
}

function hunksOf(workspace: Workspace, target: AssistTarget) {
  return workspace.files.get(targetPath(target))?.hunks ?? [];
}

function labelFor(workspace: Workspace, target: AssistTarget): string {
  return targetLabel(hunksOf(workspace, target), target);
}

function WorkspaceAssist({ workspace }: { workspace: Workspace }) {
  const { thread } = workspace.assist;
  if (!thread) return null;
  const { target } = thread;
  const path = targetPath(target);
  const hunks = hunksOf(workspace, target);
  const citationsOf = (text: string) =>
    citationsInText(text, (code) =>
      parseCitation(code, [...workspace.files.keys()], path, [...workspace.files.values()]),
    );
  return (
    <AssistPanel
      key={thread.id}
      assist={workspace.assist}
      thread={thread}
      label={targetLabel(hunks, target)}
      commentLine={targetCommentLine(hunks, target)}
      citationsOf={citationsOf}
      onSaveNote={(line, kind, body) =>
        workspace.saveNote(line === null ? null : { path, line }, kind, body)
      }
      onShowLines={() => workspace.goTo({ path, line: targetFirstLine(hunks, target) })}
      onShowCitation={(citation) =>
        workspace.goTo({ path: citation.path, line: citation.line, endLine: citation.endLine })
      }
    />
  );
}

function WorkspaceSelectionToolbar({ workspace }: { workspace: Workspace }) {
  const { selection } = workspace;
  if (!workspace.aiEnabled || !selection) return null;
  return (
    <SelectionToolbar
      selection={selection}
      onAction={(action) =>
        workspace.assist.open({ kind: "lines", range: selection.range }, action)
      }
    />
  );
}

function NoSteps({
  review,
  orientation,
}: {
  review: ReviewPayload;
  orientation: OrientationState;
}) {
  if (review.steps.length === 0) {
    return <EmptyState emoji="🫥">This PR has no file changes.</EmptyState>;
  }
  if (orientation.status !== "loading") return null;
  return <EmptyState emoji="🧭">{ORDERING_MESSAGE}</EmptyState>;
}

function navigablePaths(steps: Step[], files: ReadonlyMap<string, PreparedFile>): string[] {
  const paths = steps.flatMap((step) => step.files.map((stepFile) => stepFile.path));
  return [...new Set(paths)].filter((path) => files.get(path)?.navigable);
}

export function ReviewWorkspace({
  pullRequest,
  review: payload,
  session,
  orientation,
  controls,
}: WorkspaceProps) {
  const review = useMemo(() => {
    const steps = orderedSteps(payload.steps, orientation);
    return { ...payload, steps, startStepId: steps[0]?.id ?? null };
  }, [payload, orientation]);
  const workspace = useWorkspace(pullRequest, review, session, orientation, controls);
  const sizings = usePanelSizings(workspace.panes);
  const fresh = session.doneSteps.length === 0 && workspace.currentIndex <= 0;
  const referenceCounts = useReferenceCounts(
    pullRequest,
    review.headSha,
    navigablePaths(workspace.visibleSteps, workspace.files),
  );
  const context: StepViewContext = useMemo(
    () => ({
      files: workspace.files,
      hotspots: workspace.hotspots,
      checkedHotspots: session.checkedHotspots,
      notes: session.notes,
      composer: workspace.composer,
      landed: workspace.landed,
      occurrences: occurrencesOf(workspace.peek.peek),
      activeHunkId: workspace.activeHunkId,
      referenceCounts,
      onAskFile: workspace.aiEnabled
        ? (path, action) => workspace.assist.open({ kind: "file", path }, action)
        : null,
      handlers: {
        onIdentifier: workspace.peekName,
        onHoverIdentifier: workspace.setHovered,
        onAddNote: (path, line) => workspace.setComposer({ path, line }),
        onDeleteNote: workspace.deleteNote,
        onToggleHotspot: workspace.toggleHotspot,
        onCheckFlag: workspace.aiEnabled
          ? (range) => workspace.assist.open({ kind: "lines", range }, "check")
          : null,
        onSaveNote: (target, kind, body) => workspace.saveNote(target, kind, body),
        onCancelNote: () => workspace.setComposer(null),
        onShowReferences: workspace.peek.showReferences,
      },
    }),
    [workspace, session.notes, session.checkedHotspots, referenceCounts],
  );

  return (
    <div className="grid h-screen grid-cols-shell grid-rows-shell">
      <TopBar review={review} workspace={workspace} />
      <div className="grid min-h-0 grid-cols-workspace">
        <WorkspacePanel
          side="left"
          sizing={sizings.left}
          review={review}
          session={session}
          workspace={workspace}
          orientation={orientation}
          fresh={fresh}
        />
        <div className="relative flex min-h-0 min-w-0 flex-col">
          <div className="shrink-0 border-b bg-background px-3 py-4 sm:px-8">
            <div className="mx-auto flex max-w-5xl flex-col gap-3">
              <StepBar review={review} session={session} workspace={workspace} />
              {controls.actionError && (
                <Callout tone="error">Couldn&apos;t save: {controls.actionError}</Callout>
              )}
              <BreakBanner workspace={workspace} />
            </div>
          </div>
          <main className="min-h-0 flex-1 overflow-y-auto px-3 pb-24 sm:px-8">
            <div id="step-top" className="mx-auto flex max-w-5xl flex-col gap-6 pt-6">
              <div
                key={workspace.showAll ? "all" : workspace.currentStep?.id}
                className="flex animate-step-enter flex-col gap-8"
              >
                {workspace.visibleSteps.map((step) => (
                  <div key={step.id} className="flex flex-col gap-3">
                    {workspace.showAll && <h3 className="text-base font-bold">{step.title}</h3>}
                    <StepView step={step} context={context} />
                  </div>
                ))}
              </div>
              <NoSteps review={payload} orientation={orientation} />
            </div>
          </main>
          <div className="pointer-events-none absolute inset-x-0 bottom-6 z-20 flex justify-center px-4">
            <JumpTrail
              jumps={session.jumps}
              onBack={workspace.back}
              onClear={workspace.clearJumps}
            />
          </div>
        </div>
        <WorkspacePanel
          side="right"
          sizing={sizings.right}
          review={review}
          session={session}
          workspace={workspace}
          orientation={orientation}
          fresh={fresh}
        />
      </div>
      <WorkspaceSelectionToolbar workspace={workspace} />
      <Dialogs review={review} session={session} workspace={workspace} />
      {workspace.posted && <PostedToast onDismiss={() => workspace.setPosted(false)} />}
    </div>
  );
}
