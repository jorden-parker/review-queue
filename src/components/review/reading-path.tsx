"use client";

import { Check, Circle, Play, RotateCcw } from "lucide-react";
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
  if (done) return <Check size={16} className="text-add-ink" />;
  if (reopened) return <RotateCcw size={16} className="text-medium" />;
  return <Circle size={16} className="text-muted" />;
}

export function ReadingPath(props: ReadingPathProps) {
  const doneCount = props.steps.filter((step) => props.doneSteps.includes(step.id)).length;
  const percent = props.steps.length ? Math.round((doneCount / props.steps.length) * 100) : 0;
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <div className="flex justify-between text-sm">
          <span className="font-bold">
            {doneCount} of {props.steps.length} steps
          </span>
          <span className="text-muted">{percent}%</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-sunken">
          <div
            className="h-full rounded-full bg-add-ink transition-all"
            style={{ width: `${percent}%` }}
          />
        </div>
      </div>
      <ol className="flex flex-col gap-1">
        {props.steps.map((step, index) => {
          const done = props.doneSteps.includes(step.id);
          const current = step.id === props.currentStepId;
          return (
            <li key={step.id}>
              <div
                className={`flex items-start gap-2 rounded-lg p-2 ${current ? "bg-accent-soft" : "hover:bg-sunken"}`}
              >
                <button
                  onClick={() => props.onToggleDone(step.id)}
                  title={done ? "Mark as not done" : "Mark as done (x)"}
                  className="mt-0.5"
                >
                  <StepIcon done={done} reopened={props.reopenedStepIds.includes(step.id)} />
                </button>
                <button
                  onClick={() => props.onSelect(step.id)}
                  className="flex flex-1 flex-col text-left"
                >
                  <span className={`text-sm ${done ? "text-muted line-through" : "font-bold"}`}>
                    {index + 1}. {step.title}
                  </span>
                  <span className="text-xs text-muted">
                    {step.role} · {step.changedLines} lines
                  </span>
                  {step.id === props.startStepId && (
                    <span className="mt-1 flex w-fit items-center gap-1 rounded-full bg-focus px-2 text-xs font-bold">
                      <Play size={10} /> Start here
                    </span>
                  )}
                  {props.reopenedStepIds.includes(step.id) && (
                    <span className="mt-1 text-xs text-medium">Changed since you reviewed it</span>
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
