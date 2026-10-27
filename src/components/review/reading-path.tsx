"use client";

import { Check, Circle, Play, RotateCcw } from "lucide-react";
import { cn } from "cn";
import { Celebration } from "@/components/common/celebration";
import { EmptyState } from "@/components/common/empty-state";
import { HintButton } from "@/components/common/hint-button";
import { InlineMarkdown } from "@/components/common/markdown-text";
import { PaneRow } from "@/components/common/pane-row";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { plural } from "@/lib/plural";
import type { Step } from "@/lib/types";

type ReadingPathProps = {
  steps: Step[];
  startStepId: string | null;
  currentStepId: string | null;
  doneSteps: string[];
  reopenedStepIds: string[];
  reasons: Record<string, string>;
  ordering: boolean;
  fallback: boolean;
  onSelect: (stepId: string) => void;
  onToggleDone: (stepId: string) => void;
};

function StepIcon({ done, reopened }: { done: boolean; reopened: boolean }) {
  if (done) return <Check className="size-4 animate-pop text-primary" />;
  if (reopened) return <RotateCcw className="size-4 text-severity-medium" />;
  return <Circle className="size-4 text-muted-foreground" />;
}

function ProgressSummary({ doneCount, total }: { doneCount: number; total: number }) {
  const percent = total ? Math.round((doneCount / total) * 100) : 0;
  const finished = total > 0 && doneCount === total;
  return (
    <div className="relative flex flex-col gap-2">
      <div className="flex items-baseline justify-between text-sm">
        <span className="font-bold">
          {doneCount} of {total} steps
        </span>
        <span className="text-xs text-muted-foreground tabular-nums">
          {finished ? "🎉 all read" : `${percent}%`}
        </span>
      </div>
      <Progress value={percent} indicatorClassName="animate-shimmer bg-whimsy" />
      {finished && <Celebration />}
    </div>
  );
}

type DoneToggleProps = { done: boolean; reopened: boolean; onToggle: () => void };

function DoneToggle({ done, reopened, onToggle }: DoneToggleProps) {
  const label = done ? "Mark as not done" : "Mark as done";
  return (
    <HintButton
      variant="ghost"
      size="icon-xs"
      hint={label}
      shortcut={done ? undefined : "x"}
      aria-label={label}
      onClick={onToggle}
    >
      <StepIcon done={done} reopened={reopened} />
    </HintButton>
  );
}

type StepNotesProps = { reason: string | undefined; start: boolean; reopened: boolean };

function StepNotes({ reason, start, reopened }: StepNotesProps) {
  return (
    <>
      {reason && (
        <span data-testid="step-reason" className="text-xs text-muted-foreground">
          <InlineMarkdown text={reason} />
        </span>
      )}
      {start && (
        <Badge className="mt-1 bg-callout text-callout-foreground">
          <Play /> Start here
        </Badge>
      )}
      {reopened && (
        <span className="mt-1 text-xs text-severity-medium">Changed since you reviewed it</span>
      )}
    </>
  );
}

type StepItemProps = {
  step: Step;
  index: number;
  path: ReadingPathProps;
};

function StepItem({ step, index, path }: StepItemProps) {
  const done = path.doneSteps.includes(step.id);
  const current = step.id === path.currentStepId;
  const reopened = path.reopenedStepIds.includes(step.id);
  return (
    <PaneRow
      active={current}
      className={cn("border-l-3", current ? "border-marker" : "border-transparent")}
    >
      <span className="flex h-5 shrink-0 items-center">
        <DoneToggle done={done} reopened={reopened} onToggle={() => path.onToggleDone(step.id)} />
      </span>
      <button
        onClick={() => path.onSelect(step.id)}
        className="flex min-w-0 flex-1 flex-col gap-0.5 text-left"
      >
        <span
          className={cn(
            "text-sm wrap-anywhere",
            done ? "text-muted-foreground line-through" : "font-bold",
            current && "text-accent-foreground",
          )}
        >
          {index + 1}. {step.title}
        </span>
        <span className="flex flex-wrap gap-x-2 text-xs text-muted-foreground">
          <span>{step.role}</span>
          <span>{plural(step.changedLines, "line")}</span>
        </span>
        <StepNotes
          reason={path.reasons[step.id]}
          start={step.id === path.startStepId}
          reopened={reopened}
        />
      </button>
    </PaneRow>
  );
}

export const ORDERING_MESSAGE = "Local model is ordering the steps…";

export function ReadingPath(props: ReadingPathProps) {
  if (props.ordering) return <EmptyState emoji="🧭">{ORDERING_MESSAGE}</EmptyState>;
  const doneCount = props.steps.filter((step) => props.doneSteps.includes(step.id)).length;
  return (
    <div className="flex flex-col gap-4">
      <ProgressSummary doneCount={doneCount} total={props.steps.length} />
      {props.fallback && (
        <p className="text-xs text-muted-foreground">
          Built-in order. The local model couldn&apos;t order these.
        </p>
      )}
      <ol aria-label="Reading path" className="flex flex-col gap-0.5">
        {props.steps.map((step, index) => (
          <StepItem key={step.id} step={step} index={index} path={props} />
        ))}
      </ol>
    </div>
  );
}
