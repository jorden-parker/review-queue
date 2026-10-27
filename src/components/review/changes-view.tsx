"use client";

import { useEffect, useState } from "react";
import { Callout } from "@/components/common/callout";
import { Button } from "@/components/ui/button";
import type { Interdiff } from "@/lib/review/interdiff";
import type { PullRequestRef, Step } from "@/lib/types";
import { fetchChanges } from "./api";
import { StepView, type StepViewContext } from "./step-view";

type ChangesState =
  | { status: "loading" }
  | { status: "ready"; interdiff: Interdiff }
  | { status: "error"; message: string };

type ChangesViewProps = {
  pullRequest: PullRequestRef;
  headSha: string;
  context: StepViewContext;
  onCaughtUp: () => void;
};

function useChanges(pullRequest: PullRequestRef, headSha: string): ChangesState {
  const [state, setState] = useState<ChangesState>({ status: "loading" });
  useEffect(() => {
    let cancelled = false;
    fetchChanges(pullRequest, headSha)
      .then((interdiff) => {
        if (!cancelled) setState({ status: "ready", interdiff });
      })
      .catch((error: Error) => {
        if (!cancelled) setState({ status: "error", message: error.message });
      });
    return () => {
      cancelled = true;
    };
  }, [pullRequest, headSha]);
  return state;
}

function headingFor(state: ChangesState, headSha: string): string {
  if (state.status !== "ready") return "Since you last looked";
  const from = state.interdiff.baselineHeadSha.slice(0, 7);
  return `Since you last looked (${from} → ${headSha.slice(0, 7)})`;
}

function changedFilesStep(interdiff: Interdiff): Step {
  return {
    id: "changes",
    title: "Since you last looked",
    role: "core",
    reason: "",
    changedLines: 0,
    files: interdiff.files.map((file) => ({
      path: file.path,
      hunkIndexes: file.hunks.map((_hunk, index) => index),
    })),
  };
}

function changesContext(context: StepViewContext, interdiff: Interdiff): StepViewContext {
  return { ...context, files: new Map(interdiff.files.map((file) => [file.path, file])) };
}

function ChangesBody({ state, context }: { state: ChangesState; context: StepViewContext }) {
  if (state.status === "loading") {
    return <p className="text-sm text-muted-foreground">Loading…</p>;
  }
  if (state.status === "error") {
    return <Callout tone="error">Couldn&apos;t load the changes: {state.message}</Callout>;
  }
  if (state.interdiff.files.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">Nothing changed in the files of this review.</p>
    );
  }
  return (
    <StepView
      step={changedFilesStep(state.interdiff)}
      context={changesContext(context, state.interdiff)}
    />
  );
}

export function ChangesView({ pullRequest, headSha, context, onCaughtUp }: ChangesViewProps) {
  const state = useChanges(pullRequest, headSha);
  return (
    <section className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-base font-bold">{headingFor(state, headSha)}</h3>
        <Button onClick={onCaughtUp}>I&apos;ve caught up</Button>
      </div>
      <ChangesBody state={state} context={context} />
    </section>
  );
}
