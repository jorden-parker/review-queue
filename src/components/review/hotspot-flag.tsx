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
import { type DisplayHotspot, SEVERITY_STYLES } from "./hotspot-list";

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
        className="mt-0.5"
        title="Checked"
        aria-label={`Checked: ${hotspot.title}`}
      />
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <span className="flex items-center gap-2 font-medium wrap-anywhere">
          <span className={cn("size-2 shrink-0 rounded-full", SEVERITY_STYLES[hotspot.severity])} />
          <InlineMarkdown text={hotspot.title} />
          {hotspot.suggested && <Sparkles size={12} className="shrink-0 text-primary" />}
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

function FlagTrigger({
  ordered,
  allChecked,
  className,
  ...props
}: React.ComponentProps<"button"> & { ordered: DisplayHotspot[]; allChecked: boolean }) {
  const [lead] = ordered;
  const label = `${plural(ordered.length, "flag")} on this line${allChecked ? ", all checked" : ""}`;
  return (
    <button
      {...props}
      aria-label={label}
      className={cn(
        className,
        "flex max-w-64 items-center gap-1.5 rounded-full border px-2 py-0.5 font-sans text-xs font-medium transition-colors duration-150",
        allChecked ? DONE_CHIP : CHIP_STYLES[lead.severity],
      )}
    >
      {allChecked ? (
        <Check size={12} className="shrink-0" />
      ) : (
        <Flag size={12} className="shrink-0" />
      )}
      <span className="truncate">
        <InlineMarkdown text={lead.title} />
      </span>
      {ordered.length > 1 && <span className="shrink-0 opacity-75">+{ordered.length - 1}</span>}
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
  const allChecked = ordered.every((hotspot) => checked.includes(hotspot.id));
  const run = (action: () => void) => () => {
    setOpen(false);
    action();
  };
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <FlagTrigger ordered={ordered} allChecked={allChecked} />
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 gap-4 p-4 font-sans">
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
