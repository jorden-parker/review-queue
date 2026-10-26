"use client";

import { Coffee } from "lucide-react";
import { plural } from "@/lib/plural";
import type { Session } from "@/lib/session/store";
import type { Step } from "@/lib/types";

type ResumeCardProps = {
  session: Session;
  steps: Step[];
  nextStep: Step | null;
  reopenedCount: number;
  onContinue: () => void;
};

function sinceText(iso: string | null): string {
  if (!iso) return "";
  const minutes = Math.round((Date.now() - Date.parse(iso)) / 60_000);
  if (minutes < 60) return `${minutes} min ago`;
  if (minutes < 60 * 48) return `${Math.round(minutes / 60)} hours ago`;
  return `${Math.round(minutes / 1440)} days ago`;
}

export function ResumeCard({
  session,
  steps,
  nextStep,
  reopenedCount,
  onContinue,
}: ResumeCardProps) {
  const current = steps.find((step) => step.id === session.currentStepId);
  const position = current ? steps.indexOf(current) + 1 : null;
  const lastNote = session.notes.at(-1);
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/30 p-4">
      <section className="flex w-full max-w-lg flex-col gap-4 rounded-2xl border border-line bg-panel p-6 shadow-xl">
        <h2 className="flex items-center gap-2 text-xl font-bold">
          <Coffee size={20} /> Welcome back
        </h2>
        <dl className="flex flex-col gap-2 text-sm">
          {session.pause && (
            <div className="rounded-lg bg-focus p-3">
              <dt className="text-xs font-bold">You said you were about to</dt>
              <dd className="text-base">{session.pause.note || "(no note)"}</dd>
              <dd className="text-xs text-muted">paused {sinceText(session.pause.at)}</dd>
            </div>
          )}
          {current && (
            <div>
              <dt className="text-muted">You were on</dt>
              <dd className="font-bold">
                Step {position} of {steps.length}: {current.title}
              </dd>
            </div>
          )}
          <div>
            <dt className="text-muted">Progress</dt>
            <dd>
              {session.doneSteps.length} of {steps.length} steps done ·{" "}
              {plural(session.notes.length, "note")}
            </dd>
          </div>
          {lastNote && (
            <div>
              <dt className="text-muted">Your last note</dt>
              <dd className="italic">“{lastNote.body}”</dd>
            </div>
          )}
          {session.jumps.length > 0 && (
            <div>
              <dt className="text-muted">You were following</dt>
              <dd className="font-mono">{session.jumps.map((jump) => jump.name).join(" → ")}</dd>
            </div>
          )}
          {reopenedCount > 0 && (
            <div className="text-medium">
              New commits changed {reopenedCount} step{reopenedCount === 1 ? "" : "s"} you had
              finished. They are marked again.
            </div>
          )}
        </dl>
        <button
          onClick={onContinue}
          autoFocus
          className="rounded-lg bg-accent px-4 py-2 font-bold text-panel"
        >
          {nextStep ? `Continue with: ${nextStep.title}` : "Continue"}
        </button>
      </section>
    </div>
  );
}
