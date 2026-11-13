"use client";

import { CircleX, Info, type LucideIcon, Sparkles, TriangleAlert } from "lucide-react";
import { cn } from "cn";
import { EmptyState } from "@/components/common/empty-state";
import { InlineMarkdown } from "@/components/common/markdown-text";
import { PaneRow } from "@/components/common/pane-row";
import { PathLabel } from "@/components/common/path-label";
import { Checkbox } from "@/components/ui/checkbox";
import type { Hotspot, Severity } from "@/lib/types";

export type DisplayHotspot = Hotspot & { note?: string; suggested?: boolean };

type Diagnostic = { icon: LucideIcon; name: string; word: string; text: string; border: string };

export const DIAGNOSTICS: Record<Severity, Diagnostic> = {
  high: {
    icon: CircleX,
    name: "error",
    word: "High",
    text: "text-severity-high",
    border: "border-severity-high",
  },
  medium: {
    icon: TriangleAlert,
    name: "warning",
    word: "Medium",
    text: "text-severity-medium",
    border: "border-severity-medium",
  },
  low: {
    icon: Info,
    name: "info",
    word: "Low",
    text: "text-severity-low",
    border: "border-severity-low",
  },
};

export function describeSeverity(hotspot: DisplayHotspot): string {
  return `${DIAGNOSTICS[hotspot.severity].word} · ${hotspot.rule.replaceAll("-", " ")}`;
}

type HotspotListProps = {
  hotspots: DisplayHotspot[];
  checked: string[];
  onOpen: (hotspot: DisplayHotspot) => void;
  onToggleChecked: (id: string) => void;
};

const SEVERITY_CHECKBOX_CLASS: Record<Severity, string> = {
  high: "border-severity-high",
  medium: "border-severity-medium",
  low: "border-severity-low",
};

export function CheckedToggle({
  hotspot,
  checked,
  onToggle,
}: {
  hotspot: DisplayHotspot;
  checked: boolean;
  onToggle: () => void;
}) {
  return (
    <label className="-my-2 -ml-2 flex min-h-10 min-w-10 shrink-0 cursor-pointer items-center gap-1.5 self-start pr-1 pl-2 text-sm text-muted-foreground">
      <Checkbox
        checked={checked}
        onCheckedChange={onToggle}
        className={SEVERITY_CHECKBOX_CLASS[hotspot.severity]}
        title="Checked"
        aria-label={`Checked: ${hotspot.title}`}
      />
      <span>Checked</span>
    </label>
  );
}

export function HotspotList({ hotspots, checked, onOpen, onToggleChecked }: HotspotListProps) {
  if (hotspots.length === 0) {
    return <EmptyState emoji="🌤️">Nothing unusual spotted. Still read carefully.</EmptyState>;
  }
  const remaining = hotspots.filter((hotspot) => !checked.includes(hotspot.id)).length;
  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm text-muted-foreground">
        {remaining === 0 ? (
          <>
            <span aria-hidden>✨</span> All checked. Lovely.
          </>
        ) : (
          `${remaining} still to look at. Tick them off as you check.`
        )}
      </p>
      <ul className="flex flex-col gap-0.5">
        {hotspots.map((hotspot) => {
          const isChecked = checked.includes(hotspot.id);
          const diagnostic = DIAGNOSTICS[hotspot.severity];
          return (
            <PaneRow
              key={hotspot.id}
              className={cn("border-l-4", diagnostic.border, isChecked && "opacity-50")}
            >
              <CheckedToggle
                hotspot={hotspot}
                checked={isChecked}
                onToggle={() => onToggleChecked(hotspot.id)}
              />
              <button
                onClick={() => onOpen(hotspot)}
                className="flex min-w-0 flex-1 flex-col gap-0.5 text-left"
              >
                <span
                  className={cn(
                    "flex items-center gap-1.5 text-sm font-medium wrap-anywhere",
                    diagnostic.text,
                  )}
                >
                  <diagnostic.icon data-icon={diagnostic.name} className="size-3.5 shrink-0" />
                  {describeSeverity(hotspot)}
                </span>
                <span className="flex items-start gap-2 text-sm font-medium wrap-anywhere">
                  <span className="min-w-0">
                    <InlineMarkdown text={hotspot.title} />
                  </span>
                  {hotspot.suggested && (
                    <span className="flex h-5 shrink-0 items-center">
                      <Sparkles className="size-3.5 text-primary" />
                    </span>
                  )}
                </span>
                <PathLabel path={hotspot.path} line={hotspot.line} />
                <span className="text-sm text-muted-foreground">
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
