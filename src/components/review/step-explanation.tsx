"use client";

import { MessageCircleQuestion, Sparkles } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { InlineMarkdown, Markdown } from "@/components/common/markdown-text";
import { Button } from "@/components/ui/button";
import type { StepExplanation } from "@/lib/llm/step-explanation";
import type { ExplanationResult } from "@/lib/review/explanation-service";
import type { PullRequestRef } from "@/lib/types";
import { fetchStepExplanation } from "./api";

type ExplanationState = ExplanationResult | { status: "loading" };

type StepExplanationProps = {
  pullRequest: PullRequestRef;
  headSha: string;
  stepId: string;
  onAskMore?: (check: number, text: string) => void;
};

function ExplanationPanel({
  explanation,
  onAskMore,
}: {
  explanation: StepExplanation;
  onAskMore?: (check: number, text: string) => void;
}) {
  return (
    <div className="flex flex-col gap-1.5 rounded-lg bg-muted/60 p-3 text-sm">
      <p className="text-xs text-muted-foreground">
        The model&apos;s guess, unverified. The PR author can sway it.
      </p>
      <div className="flex items-start gap-1.5 font-medium">
        <Sparkles className="mt-0.5 size-3.5 shrink-0 text-primary" />
        <Markdown text={explanation.what} className="flex flex-col gap-1.5" />
      </div>
      {explanation.checks.length > 0 && (
        <ul className="list-disc pl-5">
          {explanation.checks.map((check, index) => (
            <li key={check}>
              <InlineMarkdown text={check} />
              {onAskMore && (
                <Button
                  variant="ghost"
                  size="xs"
                  className="ml-1 text-muted-foreground"
                  aria-label={`Ask more about: ${check}`}
                  onClick={() => onAskMore(index, check)}
                >
                  <MessageCircleQuestion /> Ask more
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ExplanationError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="flex flex-col items-start gap-2 text-sm text-muted-foreground">
      <p>Local model unavailable ({message}).</p>
      <Button variant="outline" size="sm" onClick={onRetry}>
        Try again
      </Button>
    </div>
  );
}

function useStepExplanation({ pullRequest, headSha, stepId }: StepExplanationProps) {
  const [state, setState] = useState<ExplanationState>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let current = true;
    fetchStepExplanation(pullRequest, headSha, stepId)
      .then((result) => current && setState(result))
      .catch((error: Error) => current && setState({ status: "error", message: error.message }));
    return () => {
      current = false;
    };
  }, [pullRequest, headSha, stepId, attempt]);

  const retry = useCallback(() => {
    setState({ status: "loading" });
    setAttempt((count) => count + 1);
  }, []);

  return { state, retry };
}

export function StepExplanation(props: StepExplanationProps) {
  const { state, retry } = useStepExplanation(props);
  if (state.status === "disabled") return null;
  if (state.status === "ready")
    return <ExplanationPanel explanation={state.explanation} onAskMore={props.onAskMore} />;
  if (state.status === "error") return <ExplanationError message={state.message} onRetry={retry} />;
  return <p className="text-sm text-muted-foreground">Local model is reading this step…</p>;
}
