"use client";

import { ChevronDown, ChevronUp, Sparkles } from "lucide-react";
import { cn } from "cn";
import { useState } from "react";
import { InlineMarkdown, Markdown } from "@/components/common/markdown-text";
import { PrDescription } from "@/components/common/pr-description";
import { Button } from "@/components/ui/button";
import type { ReviewPayload } from "@/lib/review/prepare";
import type { OrientationState } from "./use-review";

type OrientationCardProps = {
  review: ReviewPayload;
  orientation: OrientationState;
  fresh: boolean;
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
  const { summary, intent, risk } = orientation.orientation;
  return (
    <div className="flex flex-col gap-1.5 rounded-lg bg-muted/60 p-3 text-sm">
      <p className="text-xs text-muted-foreground">
        The model&apos;s guess, unverified. The PR author can sway it.
      </p>
      <div className="flex items-start gap-1.5 font-medium">
        <span className="flex h-5 shrink-0 items-center">
          <Sparkles className="size-3.5 text-primary" />
        </span>
        <Markdown text={summary} className="flex flex-col gap-1.5" />
      </div>
      <p>
        <span className="text-muted-foreground">Why:</span> <InlineMarkdown text={intent} />
      </p>
      <p>
        <span className="text-muted-foreground">Risk:</span>{" "}
        <span className={`font-medium ${RISK_STYLES[risk]}`}>{risk}</span>
      </p>
    </div>
  );
}

function AiSummaryLine({ orientation }: { orientation: OrientationState }) {
  if (orientation.status !== "ready") return null;
  const { summary, risk } = orientation.orientation;
  return (
    <p className="flex items-center gap-1.5 text-sm">
      <Sparkles className="size-3.5 shrink-0 text-primary" />
      <span className="truncate">
        <InlineMarkdown text={summary} />
      </span>
      <span className={`shrink-0 font-medium ${RISK_STYLES[risk]}`}>{risk} risk</span>
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

export function OrientationCard({ review, orientation, fresh }: OrientationCardProps) {
  const [expanded, setExpanded] = useState(fresh);
  return (
    <section aria-label="About this PR" className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-bold">{fresh ? "Before you start" : "About this PR"}</h2>
        <DetailsToggle expanded={expanded} onToggle={() => setExpanded(!expanded)} />
      </div>
      <div className={cn("flex flex-col", expanded ? "gap-4" : "gap-2")}>
        {expanded && review.pr.bodyHtml.trim() && <PrDescription html={review.pr.bodyHtml} />}
        <ReviewStats review={review} />
        {expanded ? (
          <AiSummary orientation={orientation} />
        ) : (
          <AiSummaryLine orientation={orientation} />
        )}
      </div>
    </section>
  );
}
