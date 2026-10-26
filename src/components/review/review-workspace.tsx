"use client";

import {
  ArrowLeft,
  ArrowRight,
  Check,
  CircleHelp,
  Coffee,
  Layers,
  RotateCcw,
  Send,
} from "lucide-react";
import Link from "next/link";
import { useMemo } from "react";
import { EmptyState } from "@/components/common/empty-state";
import { HintButton } from "@/components/common/hint-button";
import { InlineMarkdown } from "@/components/common/markdown-text";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Kbd } from "@/components/ui/kbd";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { commentLine, firstLineNumber, rangeLabel } from "@/lib/assist-protocol";
import { prKey } from "@/lib/pr-ref";
import type { ReviewPayload } from "@/lib/review/prepare";
import type { Session } from "@/lib/session/store";
import type { PullRequestRef } from "@/lib/types";
import { AssistPanel } from "./assist-panel";
import { FinishReview } from "./finish-review";
import { FocusTimer } from "./focus-timer";
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
import { StepExplanation } from "./step-explanation";
import { orderedSteps, stepReasons } from "./step-order";
import { SelectionToolbar } from "./selection-toolbar";
import { StepView, type StepViewContext } from "./step-view";
import { useReview, type OrientationState } from "./use-review";
import { useWorkspace, type SidebarTab } from "./use-workspace";

type Workspace = ReturnType<typeof useWorkspace>;

type WorkspaceProps = {
  pullRequest: PullRequestRef;
  review: ReviewPayload;
  session: Session;
  orientation: OrientationState;
  controls: ReturnType<typeof useReview>;
};

const TABS: { id: SidebarTab; label: string }[] = [
  { id: "path", label: "Path" },
  { id: "hotspots", label: "Hotspots" },
  { id: "notes", label: "Notes" },
];

function TopBar({
  review,
  session,
  workspace,
}: {
  review: ReviewPayload;
  session: Session;
  workspace: Workspace;
}) {
  return (
    <header className="flex flex-wrap items-center gap-3 border-b bg-background/80 px-4 py-2.5 backdrop-blur-md">
      <HintButton
        variant="ghost"
        size="icon-sm"
        hint="Back to inbox"
        aria-label="Back to inbox"
        asChild
      >
        <Link href="/">
          <ArrowLeft />
        </Link>
      </HintButton>
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-sm font-semibold">
          <InlineMarkdown text={review.pr.title} />
        </span>
        <span className="truncate font-mono text-xs text-muted-foreground">
          {prKey(review.pr.ref)} · {review.pr.author} · {review.headSha.slice(0, 7)}
        </span>
      </div>
      <JumpTrail jumps={session.jumps} onBack={workspace.back} onClear={workspace.clearJumps} />
      <FocusTimer onFinished={() => workspace.setBreakDue(true)} />
      <HintButton
        variant="ghost"
        size="icon-sm"
        hint="Start over"
        aria-label="Start over"
        onClick={() => workspace.setDialog("start-over")}
      >
        <RotateCcw />
      </HintButton>
      <HintButton
        variant="ghost"
        size="sm"
        hint="Pause with a note"
        shortcut="."
        onClick={() => workspace.setDialog("pause")}
      >
        <Coffee /> Pause
      </HintButton>
      <Button size="sm" onClick={() => workspace.setDialog("finish")}>
        <Send /> Finish
      </Button>
      <HintButton
        variant="ghost"
        size="icon-sm"
        hint="Keyboard shortcuts"
        shortcut="?"
        aria-label="Keyboard shortcuts"
        onClick={() => workspace.setDialog("help")}
      >
        <CircleHelp />
      </HintButton>
    </header>
  );
}

function Sidebar({
  review,
  session,
  workspace,
  orientation,
}: {
  review: ReviewPayload;
  session: Session;
  workspace: Workspace;
  orientation: OrientationState;
}) {
  const openHotspots = workspace.hotspots.filter(
    (hotspot) => !session.checkedHotspots.includes(hotspot.id),
  ).length;
  const counts: Record<SidebarTab, number | null> = {
    path: null,
    hotspots: openHotspots,
    notes: session.notes.length,
  };
  return (
    <Tabs
      value={workspace.tab}
      onValueChange={(tab) => workspace.setTab(tab as SidebarTab)}
      className="min-h-0 gap-0 border-r bg-card"
    >
      <div className="border-b p-2">
        <TabsList className="w-full">
          {TABS.map((tab) => (
            <TabsTrigger key={tab.id} value={tab.id}>
              {tab.label}
              {counts[tab.id] ? ` (${counts[tab.id]})` : ""}
            </TabsTrigger>
          ))}
        </TabsList>
      </div>
      <TabsContent
        value="path"
        className="scrollbar-hidden min-h-0 animate-step-enter overflow-y-auto p-3"
      >
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
          onToggleDone={(stepId) =>
            workspace.setStepDone(stepId, !session.doneSteps.includes(stepId))
          }
        />
      </TabsContent>
      <TabsContent
        value="hotspots"
        className="scrollbar-hidden min-h-0 animate-step-enter overflow-y-auto p-3"
      >
        <HotspotList
          hotspots={workspace.hotspots}
          checked={session.checkedHotspots}
          onOpen={(hotspot) => workspace.goTo({ path: hotspot.path, line: hotspot.line ?? 1 })}
          onToggleChecked={workspace.toggleHotspot}
        />
      </TabsContent>
      <TabsContent
        value="notes"
        className="scrollbar-hidden min-h-0 animate-step-enter overflow-y-auto p-3"
      >
        <NotesPanel
          notes={session.notes}
          parkingRef={workspace.parkingInput}
          onPark={(body) => workspace.saveNote(null, "parked", body)}
          onOpen={(note) => note.path && workspace.goTo({ path: note.path, line: note.line ?? 1 })}
          onDelete={workspace.deleteNote}
        />
      </TabsContent>
    </Tabs>
  );
}

function StepHeader({
  review,
  session,
  workspace,
}: {
  review: ReviewPayload;
  session: Session;
  workspace: Workspace;
}) {
  const step = workspace.currentStep;
  if (!step || workspace.showAll) return null;
  const done = session.doneSteps.includes(step.id);
  return (
    <Card>
      <CardHeader>
        <CardDescription className="font-mono text-xs">
          Step {workspace.currentIndex + 1} of {review.steps.length} · {step.role} ·{" "}
          {step.changedLines} lines
        </CardDescription>
        <CardTitle className="text-lg font-semibold tracking-tight">{step.title}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        <p className="text-sm text-muted-foreground">{step.reason}</p>
        {workspace.aiEnabled && (
          <StepExplanation
            key={step.id}
            pullRequest={review.pr.ref}
            headSha={review.headSha}
            stepId={step.id}
          />
        )}
        {done && (
          <Badge className="animate-pop bg-add text-add-foreground">
            <Check /> Done
          </Badge>
        )}
      </CardContent>
    </Card>
  );
}

function StepFooter({ review, workspace }: { review: ReviewPayload; workspace: Workspace }) {
  if (workspace.showAll || !workspace.currentStep) return null;
  const isLast = workspace.currentIndex >= review.steps.length - 1;
  return (
    <div className="flex items-center justify-between py-6">
      <Button
        variant="ghost"
        onClick={() => workspace.moveStep(-1)}
        disabled={workspace.currentIndex <= 0}
      >
        <ArrowLeft /> Previous (p)
      </Button>
      <Button size="lg" onClick={workspace.doneAndNext} className="px-4">
        {isLast ? "Done with this step" : "Done, next step"} <ArrowRight />
        <Kbd className="bg-primary-foreground/20 text-primary-foreground">x</Kbd>
      </Button>
    </div>
  );
}

function BreakBanner({ workspace }: { workspace: Workspace }) {
  if (!workspace.breakDue) return null;
  return (
    <Card className="animate-step-enter flex-row items-center justify-between gap-3 bg-callout px-4 text-callout-foreground ring-0">
      <span className="text-sm">
        ☕ 25 minutes of focus. Nice. Take five? Leave yourself a note first.
      </span>
      <span className="flex gap-2">
        <Button size="sm" variant="secondary" onClick={() => workspace.setDialog("pause")}>
          Pause with a note
        </Button>
        <Button size="sm" variant="ghost" onClick={() => workspace.setBreakDue(false)}>
          Keep going
        </Button>
      </span>
    </Card>
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

function ShowAllToggle({ workspace }: { workspace: Workspace }) {
  if (!workspace.currentStep) return null;
  return (
    <div className="flex items-center justify-end">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => workspace.setShowAll(!workspace.showAll)}
        className="text-muted-foreground"
      >
        <Layers />
        {workspace.showAll ? "Back to one step at a time" : "Show whole PR"} (a)
      </Button>
    </div>
  );
}

function WorkspacePeek({ workspace }: { workspace: Workspace }) {
  const { peek } = workspace.peek;
  if (!peek) return null;
  return (
    <PeekPanel
      peek={peek}
      linkable={workspace.linkable}
      inPullRequest={(path) => workspace.files.has(path)}
      onIdentifier={(name, path, line) => workspace.peekName(name, path, line)}
      onGoTo={workspace.goToFromPeek}
      onTab={(tab) => {
        if (tab === "references") workspace.peek.showReferences(peek.name, peek.from);
        else workspace.peek.showDefinitions(peek.name, peek.from);
      }}
      onClose={workspace.peek.close}
    />
  );
}

function WorkspaceAssist({ workspace }: { workspace: Workspace }) {
  const { thread } = workspace.assist;
  if (!thread) return null;
  const { range } = thread;
  const hunks = workspace.files.get(range.path)?.hunks ?? [];
  return (
    <AssistPanel
      key={`${range.path}:${range.from.hunk}:${range.from.line}:${range.to.hunk}:${range.to.line}:${thread.action}`}
      assist={workspace.assist}
      thread={thread}
      label={rangeLabel(hunks, range)}
      commentLine={commentLine(hunks, range.from, range.to)}
      onSaveNote={(line, kind, body) =>
        workspace.saveNote(line === null ? null : { path: range.path, line }, kind, body)
      }
      onShowLines={() => workspace.goTo({ path: range.path, line: firstLineNumber(hunks, range) })}
    />
  );
}

function WorkspaceSelectionToolbar({ workspace }: { workspace: Workspace }) {
  const { selection } = workspace;
  if (!workspace.aiEnabled || !selection) return null;
  return (
    <SelectionToolbar
      selection={selection}
      onAction={(action) => workspace.assist.open(selection.range, action)}
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
  const fresh = session.doneSteps.length === 0 && workspace.currentIndex <= 0;
  const context: StepViewContext = useMemo(
    () => ({
      files: workspace.files,
      linkable: workspace.linkable,
      hotspots: workspace.hotspots,
      notes: session.notes,
      composer: workspace.composer,
      activeHunkId: workspace.activeHunkId,
      handlers: {
        onIdentifier: (name, path, line) => workspace.peekName(name, path, line),
        onHoverIdentifier: workspace.setHovered,
        onAddNote: (path, line) => workspace.setComposer({ path, line }),
        onDeleteNote: workspace.deleteNote,
        onSaveNote: (target, kind, body) => workspace.saveNote(target, kind, body),
        onCancelNote: () => workspace.setComposer(null),
      },
    }),
    [workspace, session.notes],
  );

  return (
    <div className="grid h-screen grid-rows-shell">
      <TopBar review={review} session={session} workspace={workspace} />
      <div
        className={
          workspace.assist.thread
            ? "grid min-h-0 grid-cols-workspace-assist"
            : "grid min-h-0 grid-cols-workspace"
        }
      >
        <Sidebar
          review={review}
          session={session}
          workspace={workspace}
          orientation={orientation}
        />
        <div className="relative flex min-h-0 min-w-0 flex-col">
          <div className="shrink-0 border-b bg-background px-6 py-3">
            <div className="mx-auto max-w-5xl">
              <OrientationCard
                key={fresh ? "fresh" : "started"}
                review={payload}
                orientation={orientation}
                fresh={fresh}
              />
            </div>
          </div>
          <main className="scrollbar-hidden min-h-0 flex-1 overflow-y-auto px-6 pb-5">
            <div id="step-top" className="mx-auto flex max-w-5xl flex-col gap-4 pt-5">
              {controls.actionError && (
                <p className="rounded-lg bg-del px-3 py-2 text-sm text-del-foreground">
                  Couldn&apos;t save: {controls.actionError}
                </p>
              )}
              <BreakBanner workspace={workspace} />
              <ShowAllToggle workspace={workspace} />
              <div
                key={workspace.showAll ? "all" : workspace.currentStep?.id}
                className="flex animate-step-enter flex-col gap-4"
              >
                <StepHeader review={review} session={session} workspace={workspace} />
                {workspace.visibleSteps.map((step) => (
                  <div key={step.id} className="flex flex-col gap-2">
                    {workspace.showAll && (
                      <h3 className="pt-4 text-sm font-medium text-muted-foreground">
                        {step.title}
                      </h3>
                    )}
                    <StepView step={step} context={context} />
                  </div>
                ))}
              </div>
              <NoSteps review={payload} orientation={orientation} />
              <StepFooter review={review} workspace={workspace} />
            </div>
          </main>
          <WorkspacePeek workspace={workspace} />
        </div>
        <WorkspaceAssist workspace={workspace} />
      </div>
      <WorkspaceSelectionToolbar workspace={workspace} />
      <Dialogs review={review} session={session} workspace={workspace} />
      {workspace.posted && <PostedToast onDismiss={() => workspace.setPosted(false)} />}
    </div>
  );
}
