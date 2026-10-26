"use client";

import { ArrowRight, Compass, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { ReviewPayload } from "@/lib/review/prepare";
import type { OrientationState } from "./use-review";

type OrientationCardProps = {
  review: ReviewPayload;
  orientation: OrientationState;
  startStepId: string | null;
  onStart: () => void;
};

const RISK_STYLES = {
  low: "text-add-foreground",
  medium: "text-severity-medium",
  high: "text-severity-high",
};

function firstParagraph(text: string): string {
  return text.split(/\n\s*\n/)[0]?.trim() ?? "";
}

function AiSummary({ orientation }: { orientation: OrientationState }) {
  if (orientation.status === "loading") {
    return <p className="text-sm text-muted-foreground">Local model is reading the diff…</p>;
  }
  if (orientation.status === "disabled") return null;
  if (orientation.status === "error") {
    return (
      <p className="text-sm text-muted-foreground">
        Local model unavailable ({orientation.message}). Using heuristics only.
      </p>
    );
  }
  const { summary, intent, risk, startReason } = orientation.orientation;
  return (
    <div className="flex flex-col gap-1.5 rounded-lg bg-muted/60 p-3 text-sm">
      <p className="text-xs text-muted-foreground">
        The model&apos;s guess, unverified. The PR author can sway it.
      </p>
      <p className="flex items-center gap-1.5 font-medium">
        <Sparkles size={14} className="text-primary" /> {summary}
      </p>
      <p>
        <span className="text-muted-foreground">Why:</span> {intent}
      </p>
      <p>
        <span className="text-muted-foreground">Risk:</span>{" "}
        <span className={`font-medium ${RISK_STYLES[risk]}`}>{risk}</span>
      </p>
      <p>
        <span className="text-muted-foreground">Start because:</span> {startReason}
      </p>
    </div>
  );
}

export function OrientationCard({
  review,
  orientation,
  startStepId,
  onStart,
}: OrientationCardProps) {
  const highCount = review.hotspots.filter((hotspot) => hotspot.severity === "high").length;
  const description = firstParagraph(review.pr.body);
  const startIndex = review.steps.findIndex((step) => step.id === startStepId);
  return (
    <Card className="animate-step-enter">
      <CardHeader>
        <CardDescription className="flex items-center gap-2">
          <Compass size={16} className="animate-float text-primary" /> Before you start
        </CardDescription>
        <CardTitle className="text-xl font-semibold tracking-tight">{review.pr.title}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {description && <p className="line-clamp-3 text-sm text-muted-foreground">{description}</p>}
        <ul className="flex flex-wrap gap-2 text-sm">
          <li className="rounded-full border px-3 py-1">
            ≈ <strong>{review.estimateMinutes} min</strong>
          </li>
          <li className="rounded-full border px-3 py-1">
            <strong>{review.steps.length}</strong> steps
          </li>
          <li className="rounded-full border px-3 py-1">
            <strong>{review.files.length}</strong> files
          </li>
          <li className="rounded-full border px-3 py-1">
            <strong className={highCount ? "text-severity-high" : ""}>
              {review.hotspots.length}
            </strong>{" "}
            hotspots
            {highCount > 0 && ` (${highCount} serious)`}
          </li>
        </ul>
        <AiSummary orientation={orientation} />
        {startIndex >= 0 && (
          <Button size="lg" onClick={onStart} className="w-fit px-4">
            Start at step {startIndex + 1} <ArrowRight />
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
