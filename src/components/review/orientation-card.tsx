"use client";

import { Compass, Sparkles } from "lucide-react";
import type { ReviewPayload } from "@/lib/review/prepare";
import type { OrientationState } from "./use-review";

type OrientationCardProps = {
  review: ReviewPayload;
  orientation: OrientationState;
  onStart: () => void;
};

const RISK_STYLES = { low: "text-add-ink", medium: "text-medium", high: "text-high" };

function firstParagraph(text: string): string {
  return text.split(/\n\s*\n/)[0]?.trim() ?? "";
}

function AiSummary({ orientation }: { orientation: OrientationState }) {
  if (orientation.status === "loading") {
    return <p className="text-sm text-muted">Local model is reading the diff…</p>;
  }
  if (orientation.status === "disabled") return null;
  if (orientation.status === "error") {
    return (
      <p className="text-sm text-muted">
        Local model unavailable ({orientation.message}). Using heuristics only.
      </p>
    );
  }
  const { summary, intent, risk, startReason } = orientation.orientation;
  return (
    <div className="flex flex-col gap-1 text-sm">
      <p className="flex items-center gap-1 font-bold">
        <Sparkles size={14} className="text-accent" /> {summary}
      </p>
      <p>
        <span className="text-muted">Why:</span> {intent}
      </p>
      <p>
        <span className="text-muted">Risk:</span>{" "}
        <span className={`font-bold ${RISK_STYLES[risk]}`}>{risk}</span>
      </p>
      <p>
        <span className="text-muted">Start because:</span> {startReason}
      </p>
    </div>
  );
}

export function OrientationCard({ review, orientation, onStart }: OrientationCardProps) {
  const highCount = review.hotspots.filter((hotspot) => hotspot.severity === "high").length;
  const description = firstParagraph(review.pr.body);
  return (
    <section className="flex flex-col gap-3 rounded-xl border border-line bg-panel p-5">
      <div className="flex items-center gap-2 text-sm text-muted">
        <Compass size={16} /> Before you start
      </div>
      <h2 className="text-xl font-bold">{review.pr.title}</h2>
      {description && <p className="line-clamp-3 text-sm">{description}</p>}
      <ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
        <li>
          ≈ <strong>{review.estimateMinutes} min</strong>
        </li>
        <li>
          <strong>{review.steps.length}</strong> steps
        </li>
        <li>
          <strong>{review.files.length}</strong> files
        </li>
        <li>
          <strong className={highCount ? "text-high" : ""}>{review.hotspots.length}</strong>{" "}
          hotspots
          {highCount > 0 && ` (${highCount} serious)`}
        </li>
      </ul>
      <AiSummary orientation={orientation} />
      <button
        onClick={onStart}
        className="w-fit rounded-lg bg-accent px-4 py-2 font-bold text-panel"
      >
        Start at step 1
      </button>
    </section>
  );
}
