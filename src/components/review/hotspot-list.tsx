"use client";

import { Sparkles } from "lucide-react";
import { EmptyState } from "@/components/common/empty-state";
import { InlineMarkdown } from "@/components/common/markdown-text";
import { PaneRow } from "@/components/common/pane-row";
import { PathLabel } from "@/components/common/path-label";
import { Checkbox } from "@/components/ui/checkbox";
import type { Hotspot, Severity } from "@/lib/types";

export type DisplayHotspot = Hotspot & { note?: string; suggested?: boolean };

type HotspotListProps = {
  hotspots: DisplayHotspot[];
  checked: string[];
  onOpen: (hotspot: DisplayHotspot) => void;
  onToggleChecked: (id: string) => void;
};

export const SEVERITY_CHECKBOX: Record<Severity, string> = {
  high: "border-severity-high",
  medium: "border-severity-medium",
  low: "border-severity-low",
};

export function HotspotList({ hotspots, checked, onOpen, onToggleChecked }: HotspotListProps) {
  if (hotspots.length === 0) {
    return <EmptyState emoji="🌤️">Nothing unusual spotted. Still read carefully.</EmptyState>;
  }
  const remaining = hotspots.filter((hotspot) => !checked.includes(hotspot.id)).length;
  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm text-muted-foreground">
        {remaining === 0
          ? "✨ All checked. Lovely."
          : `${remaining} still to look at. Tick them off as you check.`}
      </p>
      <ul className="flex flex-col gap-0.5">
        {hotspots.map((hotspot) => {
          const isChecked = checked.includes(hotspot.id);
          return (
            <PaneRow key={hotspot.id} className={isChecked ? "opacity-50" : undefined}>
              <span className="flex h-5 shrink-0 items-center">
                <Checkbox
                  checked={isChecked}
                  onCheckedChange={() => onToggleChecked(hotspot.id)}
                  className={SEVERITY_CHECKBOX[hotspot.severity]}
                  title="Checked"
                  aria-label={`Checked: ${hotspot.title}`}
                />
              </span>
              <button
                onClick={() => onOpen(hotspot)}
                className="flex min-w-0 flex-1 flex-col gap-0.5 text-left"
              >
                <span className="flex items-start gap-2 text-sm font-medium wrap-anywhere">
                  <InlineMarkdown text={hotspot.title} />
                  {hotspot.suggested && (
                    <span className="flex h-5 shrink-0 items-center">
                      <Sparkles className="size-3.5 text-primary" />
                    </span>
                  )}
                </span>
                <PathLabel path={hotspot.path} line={hotspot.line} />
                <span className="text-xs text-muted-foreground">
                  <InlineMarkdown text={hotspot.note ?? hotspot.why} />
                </span>
              </button>
            </PaneRow>
          );
        })}
      </ul>
    </div>
  );
}
