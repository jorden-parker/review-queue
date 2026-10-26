"use client";

import { Check, Flag, MessageSquarePlus, Sparkles } from "lucide-react";
import { useState } from "react";
import { cn } from "cn";
import { InlineMarkdown } from "@/components/common/markdown-text";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { checksFor } from "@/lib/hotspots/checks";
import { plural } from "@/lib/plural";
import type { Severity } from "@/lib/types";
import { type DisplayHotspot, SEVERITY_CHECKBOX } from "./hotspot-list";

export type HotspotFlagProps = {
  hotspots: DisplayHotspot[];
  checked: string[];
  onToggleChecked: (id: string) => void;
  onAddNote: (() => void) | null;
  onCheck: (() => void) | null;
};

const SEVERITY_RANK: Record<Severity, number> = { high: 0, medium: 1, low: 2 };

const CHIP_STYLES: Record<Severity, string> = {
  high: "border-severity-high/40 bg-severity-high/10 text-severity-high hover:bg-severity-high/20",
  medium:
    "border-severity-medium/40 bg-severity-medium/10 text-severity-medium hover:bg-severity-medium/20",
  low: "border-severity-low/40 bg-severity-low/10 text-severity-low hover:bg-severity-low/20",
};

const DONE_CHIP = "border-border bg-muted/60 text-muted-foreground hover:bg-muted";

function bySeverity(hotspots: DisplayHotspot[]): DisplayHotspot[] {
  return [...hotspots].sort((a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity]);
}

function FlagDetails({
  hotspot,
  isChecked,
  onToggleChecked,
}: {
  hotspot: DisplayHotspot;
  isChecked: boolean;
  onToggleChecked: (id: string) => void;
}) {
  const checks = checksFor(hotspot.rule);
  return (
    <section
      className={cn("flex gap-3 transition-opacity duration-150", isChecked && "opacity-50")}
    >
      <Checkbox
        checked={isChecked}
        onCheckedChange={() => onToggleChecked(hotspot.id)}
        className={cn("mt-0.5", SEVERITY_CHECKBOX[hotspot.severity])}
        title="Checked"
        aria-label={`Checked: ${hotspot.title}`}
      />
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <span className="flex items-start gap-2 font-medium wrap-anywhere">
          <InlineMarkdown text={hotspot.title} />
          {hotspot.suggested && <Sparkles size={12} className="mt-1 shrink-0 text-primary" />}
        </span>
        <p className="text-muted-foreground">
          <InlineMarkdown text={hotspot.note ?? hotspot.why} />
        </p>
        {checks.length > 0 && (
          <ul className="flex flex-col gap-1 text-xs">
            {checks.map((check) => (
              <li key={check} className="flex gap-2">
                <span className="text-muted-foreground select-none">→</span>
                {check}
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

function FlagChip({ hotspot, isChecked }: { hotspot: DisplayHotspot; isChecked: boolean }) {
  return (
    <span
      data-checked={isChecked}
      className={cn(
        "flex min-w-0 items-start gap-1.5 rounded-xl border px-2 py-0.5 font-medium wrap-anywhere transition-colors duration-150",
        isChecked ? DONE_CHIP : CHIP_STYLES[hotspot.severity],
      )}
    >
      {isChecked ? (
        <Check size={12} className="mt-0.5 shrink-0" />
      ) : (
        <Flag size={12} className="mt-0.5 shrink-0" />
      )}
      <InlineMarkdown text={hotspot.title} />
    </span>
  );
}

function FlagTrigger({
  ordered,
  checked,
  className,
  ...props
}: React.ComponentProps<"button"> & { ordered: DisplayHotspot[]; checked: string[] }) {
  const allChecked = ordered.every((hotspot) => checked.includes(hotspot.id));
  const label = `${plural(ordered.length, "flag")} on this line${allChecked ? ", all checked" : ""}`;
  return (
    <button
      {...props}
      aria-label={label}
      className={cn(
        className,
        "flex max-w-full flex-wrap gap-1.5 rounded-xl text-left font-sans text-xs outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
      )}
    >
      {ordered.map((hotspot) => (
        <FlagChip key={hotspot.id} hotspot={hotspot} isChecked={checked.includes(hotspot.id)} />
      ))}
    </button>
  );
}

export function HotspotFlag({
  hotspots,
  checked,
  onToggleChecked,
  onAddNote,
  onCheck,
}: HotspotFlagProps) {
  const [open, setOpen] = useState(false);
  const ordered = bySeverity(hotspots);
  const run = (action: () => void) => () => {
    setOpen(false);
    action();
  };
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <FlagTrigger ordered={ordered} checked={checked} />
      </PopoverTrigger>
      <PopoverContent
        align="start"
        collisionPadding={12}
        className="max-h-(--radix-popover-content-available-height) w-80 max-w-(--radix-popover-content-available-width) gap-4 overflow-y-auto p-4 font-sans"
      >
        {ordered.map((hotspot) => (
          <FlagDetails
            key={hotspot.id}
            hotspot={hotspot}
            isChecked={checked.includes(hotspot.id)}
            onToggleChecked={onToggleChecked}
          />
        ))}
        {(onAddNote || onCheck) && (
          <div className="flex justify-end gap-1 border-t pt-3">
            {onAddNote && (
              <Button variant="ghost" size="xs" onClick={run(onAddNote)}>
                <MessageSquarePlus /> Add a note
              </Button>
            )}
            {onCheck && (
              <Button variant="secondary" size="xs" onClick={run(onCheck)}>
                <Sparkles /> Ask the model
              </Button>
            )}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
