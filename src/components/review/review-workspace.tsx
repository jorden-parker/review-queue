"use client";

import {
  ArrowLeft,
  ArrowRight,
  CircleHelp,
  Coffee,
  Flame,
  Layers,
  type LucideIcon,
  MessagesSquare,
  RotateCcw,
  Route,
  Send,
  Shapes,
  StickyNote,
} from "lucide-react";
import Link from "next/link";
import { type ReactNode, useMemo } from "react";
import { EmptyState } from "@/components/common/empty-state";
import { HintButton } from "@/components/common/hint-button";
import { InlineMarkdown } from "@/components/common/markdown-text";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Kbd } from "@/components/ui/kbd";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  type AssistTarget,
  targetCommentLine,
  targetFirstLine,
  targetLabel,
  targetPath,
} from "@/lib/assist-protocol";
import { prKey } from "@/lib/pr-ref";
import type { ReviewPayload } from "@/lib/review/prepare";
import type { Session } from "@/lib/session/store";
import type { PullRequestRef } from "@/lib/types";
import { AssistPanel } from "./assist-panel";
import { FinishReview } from "./finish-review";
import { FocusTimer } from "./focus-timer";
import { ContextList } from "./context-list";
import { contextCount } from "./context-symbols";
import { HotspotList } from "./hotspot-list";
import { JumpTrail } from "./jump-trail";
import { NotesPanel } from "./notes-panel";
import { PauseDialog } from "./pause-dialog";
import { PeekPanel } from "./peek-panel";
import { PostedToast } from "./posted-toast";
import { ORDERING_MESSAGE, ReadingPath } from "./reading-path";
import { ResumeCard } from "./resume-card";
import { ShortcutHelp } from "./shortcut-help";
import { StartOverDialog } from "./start-over-dialog";
import { orderedSteps, stepReasons } from "./step-order";
import { SavedChatsPanel } from "./saved-chats-panel";
import { SelectionToolbar } from "./selection-toolbar";
import { StepRail } from "./step-rail";
import { StepView, type StepViewContext } from "./step-view";
import { useReview, type OrientationState } from "./use-review";
import { useWorkspace, type SidebarTab, type Workspace } from "./use-workspace";

type WorkspaceProps = {
  pullRequest: PullRequestRef;
  review: ReviewPayload;
  session: Session;
  orientation: OrientationState;
  controls: ReturnType<typeof useReview>;
};

const TABS: { id: SidebarTab; label: string; icon: LucideIcon }[] = [
  { id: "path", label: "Path", icon: Route },
  { id: "hotspots", label: "Hotspots", icon: Flame },
  { id: "notes", label: "Notes", icon: StickyNote },
  { id: "chats", label: "Chats", icon: MessagesSquare },
  { id: "context", label: "Context", icon: Shapes },
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

function SidebarTabTrigger({ tab, count }: { tab: (typeof TABS)[number]; count: number | null }) {
  const Icon = tab.icon;
  return (
    <TabsTrigger
      value={tab.id}
      aria-label={count ? `${tab.label} (${count})` : tab.label}
      className="h-auto flex-col gap-1 px-1 py-2.5 text-xs group-data-horizontal/tabs:after:bottom-0"
    >
      <span className="relative">
        <Icon />
        {count ? (
          <span className="absolute -top-1.5 left-3 min-w-4 rounded-full bg-primary px-1 text-center text-xs/4 font-semibold text-primary-foreground">
            {count}
          </span>
        ) : null}
      </span>
      <span>{tab.label}</span>
    </TabsTrigger>
  );
}

function SidebarPanel({ value, children }: { value: SidebarTab; children: ReactNode }) {
  return (
    <TabsContent value={value} className="min-h-0 animate-step-enter overflow-y-auto p-3">
      {children}
    </TabsContent>
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
    chats: session.assistThreads.length,
    context: contextCount(session.contextSymbols, workspace.currentStep?.id ?? null),
  };
  return (
    <Tabs
      value={workspace.tab}
      onValueChange={(tab) => workspace.setTab(tab as SidebarTab)}
      className="hidden min-h-0 gap-0 border-r bg-card xl:flex"
    >
      <div className="border-b px-2">
        <TabsList
          variant="line"
          className="grid w-full grid-cols-5 p-0 group-data-horizontal/tabs:h-auto"
        >
          {TABS.map((tab) => (
            <SidebarTabTrigger key={tab.id} tab={tab} count={counts[tab.id]} />
          ))}
        </TabsList>
      </div>
      <SidebarPanel value="path">
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
      </SidebarPanel>
      <SidebarPanel value="hotspots">
        <HotspotList
          hotspots={workspace.hotspots}
          checked={session.checkedHotspots}
          onOpen={(hotspot) => workspace.goTo({ path: hotspot.path, line: hotspot.line ?? 1 })}
          onToggleChecked={workspace.toggleHotspot}
        />
      </SidebarPanel>
      <SidebarPanel value="notes">
        <NotesPanel
          notes={session.notes}
          parkingRef={workspace.parkingInput}
          onPark={(body) => workspace.saveNote(null, "parked", body)}
          onOpen={(note) => note.path && workspace.goTo({ path: note.path, line: note.line ?? 1 })}
          onDelete={workspace.deleteNote}
        />
      </SidebarPanel>
      <SidebarPanel value="chats">
        <SavedChatsPanel
          chats={session.assistThreads}
          headSha={review.headSha}
          labelOf={(chat) => labelFor(workspace, chat.target)}
          onOpen={workspace.assist.reopen}
          onDelete={(id) => {
            if (workspace.assist.thread?.id === id) workspace.assist.close();
            workspace.deleteSavedChat(id);
          }}
        />
      </SidebarPanel>
      <SidebarPanel value="context">
        <ContextList
          symbols={session.contextSymbols}
          stepId={workspace.currentStep?.id ?? null}
          jumps={session.jumps}
          onOpen={(symbol) => workspace.peekName(symbol.origin)}
          onTogglePin={(symbol) => workspace.setSymbolPinned(symbol, !symbol.pinned)}
          onBack={workspace.back}
          onClearTrail={workspace.clearJumps}
        />
      </SidebarPanel>
    </Tabs>
  );
}

function StepBar({ review, workspace }: { review: ReviewPayload; workspace: Workspace }) {
  const step = workspace.currentStep;
  if (!step) return null;
  const isLast = workspace.currentIndex >= review.steps.length - 1;
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="min-w-48 flex-1 truncate text-sm">
        <span className="font-mono text-xs text-muted-foreground">
          {workspace.currentIndex + 1}/{review.steps.length}
        </span>{" "}
        <span className="font-medium">{workspace.showAll ? "Whole PR" : step.title}</span>
      </span>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => workspace.setShowAll(!workspace.showAll)}
        className="text-muted-foreground"
      >
        <Layers />
        {workspace.showAll ? "Back to one step at a time" : "Show whole PR"} (a)
      </Button>
      {!workspace.showAll && (
        <>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => workspace.moveStep(-1)}
            disabled={workspace.currentIndex <= 0}
          >
            <ArrowLeft /> Previous (p)
          </Button>
          <Button size="sm" onClick={workspace.doneAndNext}>
            {isLast ? "Done with this step" : "Done, next step"} <ArrowRight />
            <Kbd className="bg-primary-foreground/20 text-primary-foreground">x</Kbd>
          </Button>
        </>
      )}
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
  return (
    <AssistPanel
      key={thread.id}
      assist={workspace.assist}
      thread={thread}
      label={targetLabel(hunks, target)}
      commentLine={targetCommentLine(hunks, target)}
      onSaveNote={(line, kind, body) =>
        workspace.saveNote(line === null ? null : { path, line }, kind, body)
      }
      onShowLines={() => workspace.goTo({ path, line: targetFirstLine(hunks, target) })}
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
      hotspots: workspace.hotspots,
      notes: session.notes,
      composer: workspace.composer,
      landed: workspace.landed,
      activeHunkId: workspace.activeHunkId,
      onAskFile: workspace.aiEnabled
        ? (path, action) => workspace.assist.open({ kind: "file", path }, action)
        : null,
      handlers: {
        onIdentifier: workspace.peekName,
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
      <div className="grid min-h-0 grid-cols-workspace xl:grid-cols-workspace-wide">
        <Sidebar
          review={review}
          session={session}
          workspace={workspace}
          orientation={orientation}
        />
        <div className="relative flex min-h-0 min-w-0 flex-col">
          <div className="shrink-0 border-b bg-background px-6 py-2">
            <div className="mx-auto flex max-w-5xl flex-col gap-2">
              <StepBar review={review} workspace={workspace} />
              {controls.actionError && (
                <p className="rounded-lg bg-del px-3 py-2 text-sm text-del-foreground">
                  Couldn&apos;t save: {controls.actionError}
                </p>
              )}
              <BreakBanner workspace={workspace} />
            </div>
          </div>
          <main className="min-h-0 flex-1 overflow-y-auto px-6 pb-5">
            <div id="step-top" className="mx-auto flex max-w-5xl flex-col gap-4 pt-5">
              <div
                key={workspace.showAll ? "all" : workspace.currentStep?.id}
                className="flex animate-step-enter flex-col gap-4"
              >
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
            </div>
          </main>
          <WorkspacePeek workspace={workspace} />
        </div>
        <StepRail
          review={review}
          session={session}
          workspace={workspace}
          orientation={orientation}
          fresh={fresh}
          assist={<WorkspaceAssist workspace={workspace} />}
        />
      </div>
      <WorkspaceSelectionToolbar workspace={workspace} />
      <Dialogs review={review} session={session} workspace={workspace} />
      {workspace.posted && <PostedToast onDismiss={() => workspace.setPosted(false)} />}
    </div>
  );
}
