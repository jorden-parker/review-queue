"use client";

import {
  CircleCheck,
  CircleX,
  Info,
  type LucideIcon,
  MessageSquarePlus,
  Sparkles,
  TriangleAlert,
} from "lucide-react";
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

type Diagnostic = { icon: LucideIcon; name: string; text: string };

const DIAGNOSTICS: Record<Severity, Diagnostic> = {
  high: { icon: CircleX, name: "error", text: "text-severity-high" },
  medium: { icon: TriangleAlert, name: "warning", text: "text-severity-medium" },
  low: { icon: Info, name: "info", text: "text-severity-low" },
};

const LINE_TINTS: Record<Severity, string> = {
  high: "bg-severity-high/10",
  medium: "bg-severity-medium/10",
  low: "bg-severity-low/10",
};

const CHECKED: Diagnostic = { icon: CircleCheck, name: "checked", text: "text-muted-foreground" };

function bySeverity(hotspots: DisplayHotspot[]): DisplayHotspot[] {
  return [...hotspots].sort((a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity]);
}

export function flagLineTint(hotspots: DisplayHotspot[], checked: string[]): string {
  const [worst] = bySeverity(hotspots.filter((hotspot) => !checked.includes(hotspot.id)));
  return worst ? LINE_TINTS[worst.severity] : "";
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
      className={cn("flex gap-2 transition-opacity duration-150", isChecked && "opacity-50")}
    >
      <span className="flex h-5 shrink-0 items-center">
        <Checkbox
          checked={isChecked}
          onCheckedChange={() => onToggleChecked(hotspot.id)}
          className={SEVERITY_CHECKBOX[hotspot.severity]}
          title="Checked"
          aria-label={`Checked: ${hotspot.title}`}
        />
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <span className="flex items-start gap-2 font-medium wrap-anywhere">
          <InlineMarkdown text={hotspot.title} />
          {hotspot.suggested && (
            <span className="flex h-5 shrink-0 items-center">
              <Sparkles className="size-3.5 text-primary" />
            </span>
          )}
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
  const diagnostic = isChecked ? CHECKED : DIAGNOSTICS[hotspot.severity];
  const Icon = diagnostic.icon;
  return (
    <span
      data-checked={isChecked}
      className={cn("inline-flex min-w-0 items-center gap-1.5 wrap-anywhere", diagnostic.text)}
    >
      <Icon data-icon={diagnostic.name} className="size-3.5 shrink-0" />
      <span
        className={cn(
          "decoration-current/50 underline-offset-2 group-hover/flag:underline",
          isChecked && "line-through",
        )}
      >
        <InlineMarkdown text={hotspot.title} />
      </span>
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
        "group/flag flex max-w-full flex-wrap items-center gap-x-4 gap-y-1 rounded-sm text-left font-mono text-xs outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
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
