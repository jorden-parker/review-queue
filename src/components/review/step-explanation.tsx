"use client";

import { Sparkles } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import type { StepExplanation } from "@/lib/llm/step-explanation";
import type { ExplanationResult } from "@/lib/review/explanation-service";
import type { PullRequestRef } from "@/lib/types";
import { fetchStepExplanation } from "./api";

type ExplanationState = ExplanationResult | { status: "idle" } | { status: "loading" };

type StepExplanationProps = {
  pullRequest: PullRequestRef;
  headSha: string;
  stepId: string;
};

function ExplanationPanel({ explanation }: { explanation: StepExplanation }) {
  return (
    <div className="flex flex-col gap-1.5 rounded-lg bg-muted/60 p-3 text-sm">
      <p className="text-xs text-muted-foreground">
        The model&apos;s guess, unverified. The PR author can sway it.
      </p>
      <p className="flex items-center gap-1.5 font-medium">
        <Sparkles size={14} className="text-primary" /> {explanation.what}
      </p>
      {explanation.checks.length > 0 && (
        <ul className="list-disc pl-5">
          {explanation.checks.map((check) => (
            <li key={check}>{check}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ExplainButton({ onExplain }: { onExplain: () => void }) {
  return (
    <Button variant="outline" size="sm" className="w-fit" onClick={onExplain}>
      <Sparkles /> Explain this step
    </Button>
  );
}

export function StepExplanation({ pullRequest, headSha, stepId }: StepExplanationProps) {
  const [state, setState] = useState<ExplanationState>({ status: "idle" });

  const explain = () => {
    setState({ status: "loading" });
    fetchStepExplanation(pullRequest, headSha, stepId)
      .then(setState)
      .catch((error: Error) => setState({ status: "error", message: error.message }));
  };

  if (state.status === "disabled") return null;
  if (state.status === "ready") return <ExplanationPanel explanation={state.explanation} />;
  if (state.status === "error") {
    return (
      <p className="text-sm text-muted-foreground">Local model unavailable ({state.message}).</p>
    );
  }
  if (state.status === "loading") {
    return <p className="text-sm text-muted-foreground">Local model is reading this step…</p>;
  }
  return <ExplainButton onExplain={explain} />;
}
