import { ChevronLeft, ChevronRight } from "lucide-react";
import type { KeyboardEvent } from "react";
import { cn } from "cn";
import { splitPath } from "@/components/common/path-label";
import { Button } from "@/components/ui/button";
import type { Citation } from "./citations";

function lineRange({ line, endLine }: Citation): string {
  return endLine > line ? `:${line}-${endLine}` : `:${line}`;
}

export function CitationChip({
  citation,
  active,
  onShow,
}: {
  citation: Citation;
  active: boolean;
  onShow: () => void;
}) {
  const { directory, name } = splitPath(citation.path);
  const show = citation.inDiff ? onShow : undefined;
  return (
    <span
      role="button"
      tabIndex={citation.inDiff ? 0 : undefined}
      aria-disabled={!citation.inDiff}
      title={citation.inDiff ? citation.path : "Not in this diff"}
      aria-pressed={active}
      onClick={show}
      onKeyDown={show && ((event) => activateOnKey(event, show))}
      className={cn(
        "cursor-pointer rounded-xs font-mono text-code wrap-anywhere underline decoration-dotted decoration-1 underline-offset-4 outline-none transition-colors duration-calm hover:decoration-primary focus-visible:ring-3 focus-visible:ring-ring/50 aria-disabled:cursor-default aria-disabled:text-muted-foreground aria-disabled:no-underline",
        active ? "text-primary decoration-primary" : "decoration-foreground/25",
      )}
    >
      <span className="text-muted-foreground">{directory}</span>
      <span className="font-medium">{name}</span>
      <span className="text-muted-foreground">{lineRange(citation)}</span>
    </span>
  );
}

function activateOnKey(event: KeyboardEvent<HTMLElement>, activate: () => void) {
  if (event.key !== "Enter" && event.key !== " ") return;
  event.preventDefault();
  activate();
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
