"use client";

import { ArrowLeft, ArrowRight, Check, CircleHelp, Coffee, Layers, Send } from "lucide-react";
import Link from "next/link";
import { useMemo } from "react";
import { prKey } from "@/lib/pr-ref";
import type { ReviewPayload } from "@/lib/review/prepare";
import type { Session } from "@/lib/session/store";
import type { PullRequestRef } from "@/lib/types";
import { FinishReview } from "./finish-review";
import { FocusTimer } from "./focus-timer";
import { HotspotList } from "./hotspot-list";
import { JumpTrail } from "./jump-trail";
import { NotesPanel } from "./notes-panel";
import { OrientationCard } from "./orientation-card";
import { PauseDialog } from "./pause-dialog";
import { PeekPanel } from "./peek-panel";
import { ReadingPath } from "./reading-path";
import { ResumeCard } from "./resume-card";
import { ShortcutHelp } from "./shortcut-help";
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
    <header className="flex flex-wrap items-center gap-3 border-b border-line bg-panel px-4 py-2">
      <Link href="/" className="text-muted hover:text-ink" title="Back to inbox">
        <ArrowLeft size={18} />
      </Link>
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="truncate font-bold">{review.pr.title}</span>
        <span className="text-xs text-muted">
          {prKey(review.pr.ref)} · {review.pr.author} · {review.headSha.slice(0, 7)}
        </span>
      </div>
      <JumpTrail jumps={session.jumps} onBack={workspace.back} onClear={workspace.clearJumps} />
      <FocusTimer onFinished={() => workspace.setBreakDue(true)} />
      <button
        onClick={() => workspace.setDialog("pause")}
        className="flex items-center gap-1 rounded-lg px-2 py-1 text-sm hover:bg-sunken"
        title="Pause (.)"
      >
        <Coffee size={16} /> Pause
      </button>
      <button
        onClick={() => workspace.setDialog("finish")}
        className="flex items-center gap-1 rounded-lg bg-accent px-3 py-1 text-sm font-bold text-panel"
      >
        <Send size={14} /> Finish
      </button>
      <button
        onClick={() => workspace.setDialog("help")}
        title="Keyboard shortcuts (?)"
        className="text-muted"
      >
        <CircleHelp size={18} />
      </button>
    </header>
  );
}

function Sidebar({
  review,
  session,
  workspace,
}: {
  review: ReviewPayload;
  session: Session;
  workspace: Workspace;
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
    <aside className="flex flex-col overflow-hidden border-r border-line bg-panel">
      <nav className="flex border-b border-line">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => workspace.setTab(tab.id)}
            className={`flex-1 px-2 py-2 text-sm ${workspace.tab === tab.id ? "border-b-2 border-accent font-bold" : "text-muted"}`}
          >
            {tab.label}
            {counts[tab.id] ? ` (${counts[tab.id]})` : ""}
          </button>
        ))}
      </nav>
      <div className="flex-1 overflow-y-auto p-3">
        {workspace.tab === "path" && (
          <ReadingPath
            steps={review.steps}
            startStepId={review.startStepId}
            currentStepId={workspace.currentStep?.id ?? null}
            doneSteps={session.doneSteps}
            reopenedStepIds={review.reopenedStepIds}
            onSelect={(stepId) => workspace.selectStep(stepId)}
            onToggleDone={(stepId) =>
              workspace.setStepDone(stepId, !session.doneSteps.includes(stepId))
            }
          />
        )}
        {workspace.tab === "hotspots" && (
          <HotspotList
            hotspots={workspace.hotspots}
            checked={session.checkedHotspots}
            onOpen={(hotspot) => workspace.goTo({ path: hotspot.path, line: hotspot.line ?? 1 })}
            onToggleChecked={workspace.toggleHotspot}
          />
        )}
        {workspace.tab === "notes" && (
          <NotesPanel
            notes={session.notes}
            parkingRef={workspace.parkingInput}
            onPark={(body) => workspace.saveNote(null, "parked", body)}
            onOpen={(note) =>
              note.path && workspace.goTo({ path: note.path, line: note.line ?? 1 })
            }
            onDelete={workspace.deleteNote}
          />
        )}
      </div>
    </aside>
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
    <div className="flex flex-col gap-1 rounded-xl border border-line bg-panel p-4">
      <span className="text-sm text-muted">
        Step {workspace.currentIndex + 1} of {review.steps.length} · {step.role} ·{" "}
        {step.changedLines} lines
      </span>
      <h2 className="text-lg font-bold">{step.title}</h2>
      <p className="text-sm">{step.reason}</p>
      {done && (
        <span className="flex items-center gap-1 text-sm text-add-ink">
          <Check size={14} /> Done
        </span>
      )}
    </div>
  );
}

function StepFooter({ review, workspace }: { review: ReviewPayload; workspace: Workspace }) {
  if (workspace.showAll || !workspace.currentStep) return null;
  const isLast = workspace.currentIndex >= review.steps.length - 1;
  return (
    <div className="flex items-center justify-between py-6">
      <button
        onClick={() => workspace.moveStep(-1)}
        disabled={workspace.currentIndex <= 0}
        className="flex items-center gap-1 text-sm text-muted disabled:opacity-30"
      >
        <ArrowLeft size={14} /> Previous (p)
      </button>
      <button
        onClick={workspace.doneAndNext}
        className="flex items-center gap-2 rounded-lg bg-accent px-5 py-2 font-bold text-panel"
      >
        {isLast ? "Done with this step" : "Done, next step"} <ArrowRight size={16} />
        <kbd className="rounded bg-panel/20 px-1 font-mono text-xs">x</kbd>
      </button>
    </div>
  );
}

function BreakBanner({ workspace }: { workspace: Workspace }) {
  if (!workspace.breakDue) return null;
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl bg-focus p-3 text-sm">
      <span>25 minutes of focus. Nice. Take five? Leave yourself a note first.</span>
      <span className="flex gap-2">
        <button onClick={() => workspace.setDialog("pause")} className="font-bold">
          Pause with a note
        </button>
        <button onClick={() => workspace.setBreakDue(false)} className="text-muted">
          Keep going
        </button>
      </span>
    </div>
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
          onCancel={close}
        />
      );
    case "help":
      return <ShortcutHelp onClose={close} />;
    default:
      return null;
  }
}

export function ReviewWorkspace({
  pullRequest,
  review,
  session,
  orientation,
  controls,
}: WorkspaceProps) {
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
    <div className="grid h-screen grid-rows-[auto_1fr]">
      <TopBar review={review} session={session} workspace={workspace} />
      <div
        className={`grid min-h-0 ${workspace.peek.peek ? "grid-cols-[300px_1fr_440px]" : "grid-cols-[300px_1fr]"}`}
      >
        <Sidebar review={review} session={session} workspace={workspace} />
        <main className="min-w-0 overflow-y-auto px-6 py-4">
          <div id="step-top" className="mx-auto flex max-w-5xl flex-col gap-4">
            {controls.actionError && (
              <p className="rounded-lg bg-del p-2 text-sm text-del-ink">
                Couldn&apos;t save: {controls.actionError}
              </p>
            )}
            <BreakBanner workspace={workspace} />
            {fresh && (
              <OrientationCard
                review={review}
                orientation={orientation}
                onStart={() => review.steps[0] && workspace.selectStep(review.steps[0].id)}
              />
            )}
            <div className="flex items-center justify-end">
              <button
                onClick={() => workspace.setShowAll(!workspace.showAll)}
                className="flex items-center gap-1 text-sm text-muted hover:text-ink"
              >
                <Layers size={14} />{" "}
                {workspace.showAll ? "Back to one step at a time" : "Show whole PR"} (a)
              </button>
            </div>
            <StepHeader review={review} session={session} workspace={workspace} />
            {workspace.visibleSteps.map((step) => (
              <div key={step.id} className="flex flex-col gap-2">
                {workspace.showAll && (
                  <h3 className="pt-4 text-sm font-bold text-muted">{step.title}</h3>
                )}
                <StepView step={step} context={context} />
              </div>
            ))}
            {review.steps.length === 0 && (
              <p className="text-muted">This PR has no file changes.</p>
            )}
            <StepFooter review={review} workspace={workspace} />
          </div>
        </main>
        {workspace.peek.peek && (
          <PeekPanel
            peek={workspace.peek.peek}
            inPullRequest={(path) => workspace.files.has(path)}
            onGoTo={workspace.goToFromPeek}
            onTab={(tab) => {
              const current = workspace.peek.peek!;
              if (tab === "references") workspace.peek.showReferences(current.name, current.from);
              else workspace.peek.showDefinitions(current.name, current.from);
            }}
            onClose={workspace.peek.close}
          />
        )}
      </div>
      <Dialogs review={review} session={session} workspace={workspace} />
    </div>
  );
}
