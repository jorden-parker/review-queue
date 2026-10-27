import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Citation } from "./citations";

export function CitationChip({
  index,
  citation,
  active,
  onShow,
}: {
  index: number;
  citation: Citation;
  active: boolean;
  onShow: () => void;
}) {
  return (
    <button
      type="button"
      disabled={!citation.inDiff}
      title={citation.inDiff ? undefined : "Not in this diff"}
      aria-pressed={active}
      onClick={onShow}
      className="rounded bg-muted px-1 font-mono text-xs text-foreground hover:bg-accent disabled:text-muted-foreground disabled:opacity-60"
    >
      <span className="mr-1 text-primary">{index + 1}</span>
      {citation.code}
    </button>
  );
}

function stepsInDiff(citations: Citation[]): number[] {
  return citations.flatMap((citation, index) => (citation.inDiff ? [index] : []));
}

export function CitationWalk({
  citations,
  activeIndex,
  onStep,
}: {
  citations: Citation[];
  activeIndex: number | null;
  onStep: (index: number) => void;
}) {
  const steps = stepsInDiff(citations);
  if (steps.length < 2) return null;
  const current = activeIndex ?? -1;
  const next = steps.find((index) => index > current) ?? null;
  const previous = steps.filter((index) => index < current).at(-1) ?? null;
  const position = steps.indexOf(current);
  const goTo = (index: number | null) => {
    if (index !== null) onStep(index);
  };
  return (
    <div className="flex items-center gap-2 text-xs text-muted-foreground">
      <span>Walk through</span>
      <Button
        variant="ghost"
        size="icon-xs"
        aria-label="Previous citation"
        disabled={previous === null}
        onClick={() => goTo(previous)}
      >
        <ChevronLeft />
      </Button>
      <span className="tabular-nums">
        {position === -1 ? `${steps.length} to go` : `${position + 1} of ${steps.length}`}
      </span>
      <Button
        variant="ghost"
        size="icon-xs"
        aria-label="Next citation"
        disabled={next === null}
        onClick={() => goTo(next)}
      >
        <ChevronRight />
      </Button>
    </div>
  );
}
