"use client";

import { Check, Circle, Play, RotateCcw } from "lucide-react";
import { cn } from "cn";
import { Celebration } from "@/components/common/celebration";
import { HintButton } from "@/components/common/hint-button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import type { Step } from "@/lib/types";

type ReadingPathProps = {
  steps: Step[];
  startStepId: string | null;
  currentStepId: string | null;
  doneSteps: string[];
  reopenedStepIds: string[];
  onSelect: (stepId: string) => void;
  onToggleDone: (stepId: string) => void;
};

function StepIcon({ done, reopened }: { done: boolean; reopened: boolean }) {
  if (done) return <Check size={16} className="animate-pop text-add-foreground" />;
  if (reopened) return <RotateCcw size={16} className="text-severity-medium" />;
  return <Circle size={16} className="text-muted-foreground" />;
}

function ProgressSummary({ doneCount, total }: { doneCount: number; total: number }) {
  const percent = total ? Math.round((doneCount / total) * 100) : 0;
  const finished = total > 0 && doneCount === total;
  return (
    <div className="relative flex flex-col gap-2">
      <div className="flex items-baseline justify-between text-sm">
        <span className="font-medium">
          {doneCount} of {total} steps
        </span>
        <span className="font-mono text-xs text-muted-foreground">
          {finished ? "🎉 all read" : `${percent}%`}
        </span>
      </div>
      <Progress value={percent} indicatorClassName="animate-shimmer bg-whimsy" />
      {finished && <Celebration />}
    </div>
  );
}

export function ReadingPath(props: ReadingPathProps) {
  const doneCount = props.steps.filter((step) => props.doneSteps.includes(step.id)).length;
  return (
    <div className="flex flex-col gap-4">
      <ProgressSummary doneCount={doneCount} total={props.steps.length} />
      <ol className="flex flex-col gap-0.5">
        {props.steps.map((step, index) => {
          const done = props.doneSteps.includes(step.id);
          const current = step.id === props.currentStepId;
          const reopened = props.reopenedStepIds.includes(step.id);
          return (
            <li key={step.id}>
              <div
                className={cn(
                  "flex items-start gap-2 rounded-lg p-2 transition-colors duration-150",
                  current ? "bg-accent" : "hover:bg-muted",
                )}
              >
                <HintButton
                  variant="ghost"
                  size="icon-xs"
                  hint={done ? "Mark as not done" : "Mark as done"}
                  shortcut={done ? undefined : "x"}
                  aria-label={done ? "Mark as not done" : "Mark as done"}
                  onClick={() => props.onToggleDone(step.id)}
                >
                  <StepIcon done={done} reopened={reopened} />
                </HintButton>
                <button
                  onClick={() => props.onSelect(step.id)}
                  className="flex min-w-0 flex-1 flex-col gap-0.5 text-left"
                >
                  <span
                    className={cn(
                      "text-sm wrap-anywhere",
                      done ? "text-muted-foreground line-through" : "font-medium",
                      current && "text-accent-foreground",
                    )}
                  >
                    {index + 1}. {step.title}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {step.role} · {step.changedLines} lines
                  </span>
                  {step.id === props.startStepId && (
                    <Badge className="mt-1 bg-callout text-callout-foreground">
                      <Play /> Start here
                    </Badge>
                  )}
                  {reopened && (
                    <span className="mt-1 text-xs text-severity-medium">
                      Changed since you reviewed it
                    </span>
                  )}
                </button>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
