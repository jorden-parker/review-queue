"use client";

import { Sparkles } from "lucide-react";
import { cn } from "cn";
import { EmptyState } from "@/components/common/empty-state";
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

const SEVERITY_STYLES: Record<Severity, string> = {
  high: "bg-severity-high",
  medium: "bg-severity-medium",
  low: "bg-severity-low",
};

export function HotspotList({ hotspots, checked, onOpen, onToggleChecked }: HotspotListProps) {
  if (hotspots.length === 0) {
    return <EmptyState emoji="🌤️">Nothing unusual spotted. Still read carefully.</EmptyState>;
  }
  const remaining = hotspots.filter((hotspot) => !checked.includes(hotspot.id)).length;
  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-muted-foreground">
        {remaining === 0
          ? "✨ All checked. Lovely."
          : `${remaining} still to look at. Tick them off as you check.`}
      </p>
      <ul className="flex flex-col gap-0.5">
        {hotspots.map((hotspot) => {
          const isChecked = checked.includes(hotspot.id);
          return (
            <li
              key={hotspot.id}
              className={cn(
                "flex gap-3 rounded-lg p-2 transition-[background-color,opacity] duration-150 hover:bg-muted",
                isChecked && "opacity-50",
              )}
            >
              <Checkbox
                checked={isChecked}
                onCheckedChange={() => onToggleChecked(hotspot.id)}
                className="mt-0.5"
                title="Checked"
                aria-label={`Checked: ${hotspot.title}`}
              />
              <button
                onClick={() => onOpen(hotspot)}
                className="flex min-w-0 flex-1 flex-col gap-0.5 text-left"
              >
                <span className="flex items-center gap-2 text-sm font-medium">
                  <span
                    className={cn(
                      "size-2 shrink-0 rounded-full",
                      SEVERITY_STYLES[hotspot.severity],
                    )}
                  />
                  {hotspot.title}
                  {hotspot.suggested && <Sparkles size={12} className="text-primary" />}
                </span>
                <PathLabel path={hotspot.path} line={hotspot.line} />
                <span className="text-xs text-muted-foreground">{hotspot.note ?? hotspot.why}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
