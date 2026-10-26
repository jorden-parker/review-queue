"use client";

import { ArrowRight, ChevronDown, ChevronUp, Compass, Sparkles } from "lucide-react";
import { useState } from "react";
import { PrDescription } from "@/components/common/pr-description";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { ReviewPayload } from "@/lib/review/prepare";
import type { OrientationState } from "./use-review";

type OrientationCardProps = {
  review: ReviewPayload;
  orientation: OrientationState;
  startStepId: string | null;
  defaultExpanded: boolean;
  onStart?: () => void;
};

const RISK_STYLES = {
  low: "text-add-foreground",
  medium: "text-severity-medium",
  high: "text-severity-high",
};

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

function AiSummaryLine({ orientation }: { orientation: OrientationState }) {
  if (orientation.status !== "ready") return null;
  const { summary, risk } = orientation.orientation;
  return (
    <p className="flex items-center gap-1.5 text-sm">
      <Sparkles size={14} className="shrink-0 text-primary" />
      <span className="truncate">{summary}</span>
      <span className={`shrink-0 font-medium ${RISK_STYLES[risk]}`}>· {risk} risk</span>
    </p>
  );
}

function ReviewStats({ review }: { review: ReviewPayload }) {
  const highCount = review.hotspots.filter((hotspot) => hotspot.severity === "high").length;
  return (
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
        <strong className={highCount ? "text-severity-high" : ""}>{review.hotspots.length}</strong>{" "}
        hotspots
        {highCount > 0 && ` (${highCount} serious)`}
      </li>
    </ul>
  );
}

function DetailsToggle({ expanded, onToggle }: { expanded: boolean; onToggle: () => void }) {
  return (
    <Button variant="ghost" size="sm" aria-expanded={expanded} onClick={onToggle}>
      {expanded ? "Hide details" : "Show details"}
      {expanded ? <ChevronUp /> : <ChevronDown />}
    </Button>
  );
}

export function OrientationCard({
  review,
  orientation,
  startStepId,
  defaultExpanded,
  onStart,
}: OrientationCardProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const startIndex = review.steps.findIndex((step) => step.id === startStepId);
  return (
    <Card size={expanded ? "default" : "sm"}>
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <CardDescription className="flex items-center gap-2">
            <Compass size={16} className="animate-float text-primary" />
            {onStart ? "Before you start" : "About this PR"}
          </CardDescription>
          <DetailsToggle expanded={expanded} onToggle={() => setExpanded(!expanded)} />
        </div>
        <CardTitle
          className={expanded ? "text-xl font-semibold tracking-tight" : "truncate font-semibold"}
        >
          {review.pr.title}
        </CardTitle>
      </CardHeader>
      <CardContent
        className={`flex flex-col ${expanded ? "max-h-pinned gap-4 overflow-y-auto" : "gap-2"}`}
      >
        {expanded && review.pr.bodyHtml.trim() && <PrDescription html={review.pr.bodyHtml} />}
        <ReviewStats review={review} />
        {expanded ? (
          <AiSummary orientation={orientation} />
        ) : (
          <AiSummaryLine orientation={orientation} />
        )}
        {expanded && onStart && startIndex >= 0 && (
          <Button size="lg" onClick={onStart} className="w-fit px-4">
            Start at step {startIndex + 1} <ArrowRight />
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
