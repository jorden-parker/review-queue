"use client";

import { BookOpen, Eraser, Pin, PinOff, Undo2 } from "lucide-react";
import { useState } from "react";
import { cn } from "cn";
import { EmptyState } from "@/components/common/empty-state";
import { HintButton } from "@/components/common/hint-button";
import { PaneRow } from "@/components/common/pane-row";
import { PathLabel } from "@/components/common/path-label";
import { Button } from "@/components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import type { ContextSymbol, Jump } from "@/lib/session/store";
import {
  ALL_KIND_GROUPS,
  type ContextFilter,
  type ContextView,
  type KindGroup,
  visibleSymbols,
} from "./context-symbols";
import { KIND_ICONS } from "./symbol-kind-icons";

type ContextListProps = {
  symbols: ContextSymbol[];
  stepId: string | null;
  jumps: Jump[];
  onOpen: (symbol: ContextSymbol) => void;
  onTogglePin: (symbol: ContextSymbol) => void;
  onBack: () => void;
  onClearTrail: () => void;
};

const VIEWS: { id: ContextView; label: string }[] = [
  { id: "pinned", label: "Pinned" },
  { id: "step", label: "This step" },
  { id: "all", label: "All" },
];

const KIND_GROUP_LABELS: Record<KindGroup, string> = {
  functions: "Functions",
  types: "Types",
  values: "Values",
  library: "Library",
};

function TrailButtons({
  jumps,
  onBack,
  onClearTrail,
}: Pick<ContextListProps, "jumps" | "onBack" | "onClearTrail">) {
  if (jumps.length === 0) return null;
  const last = jumps.at(-1)!;
  return (
    <div className="flex items-center gap-1">
      <HintButton variant="outline" size="xs" hint="Go back one jump" shortcut="b" onClick={onBack}>
        <Undo2 /> Back to {last.name}
      </HintButton>
      <Button variant="ghost" size="xs" onClick={onClearTrail} className="text-muted-foreground">
        <Eraser /> Forget trail
      </Button>
    </div>
  );
}

function FilterBar({
  filter,
  onChange,
}: {
  filter: ContextFilter;
  onChange: (filter: ContextFilter) => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      <ToggleGroup
        type="single"
        variant="outline"
        size="sm"
        spacing={0}
        value={filter.view}
        onValueChange={(view) => view && onChange({ ...filter, view: view as ContextView })}
        className="w-full"
      >
        {VIEWS.map((view) => (
          <ToggleGroupItem key={view.id} value={view.id} className="flex-1">
            {view.label}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
      <ToggleGroup
        type="multiple"
        size="sm"
        value={filter.shown}
        onValueChange={(shown) => onChange({ ...filter, shown: shown as KindGroup[] })}
        className="flex-wrap"
      >
        {ALL_KIND_GROUPS.map((group) => (
          <ToggleGroupItem key={group} value={group} className="text-xs">
            {group === "library" && <BookOpen />}
            {KIND_GROUP_LABELS[group]}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
    </div>
  );
}

function SymbolRow({
  symbol,
  onOpen,
  onTogglePin,
}: { symbol: ContextSymbol } & Pick<ContextListProps, "onOpen" | "onTogglePin">) {
  const Icon = KIND_ICONS[symbol.kind];
  const pinLabel = `${symbol.pinned ? "Unpin" : "Pin"} ${symbol.name}`;
  return (
    <PaneRow className="group">
      <button
        aria-label={`Open ${symbol.name}`}
        onClick={() => onOpen(symbol)}
        className="flex min-w-0 flex-1 flex-col gap-0.5 text-left"
      >
        <span className="flex items-center gap-1.5 text-sm">
          <Icon className="size-3.5 shrink-0 text-primary" aria-hidden />
          <span className="truncate font-mono font-medium">{symbol.name}</span>
          <span className="text-xs text-muted-foreground">{symbol.kind}</span>
        </span>
        <PathLabel path={symbol.path} line={symbol.scope === "external" ? null : symbol.line} />
        {symbol.signature && (
          <code className="truncate font-mono text-xs text-muted-foreground">
            {symbol.signature}
          </code>
        )}
      </button>
      <HintButton
        variant="ghost"
        size="icon-xs"
        hint={symbol.pinned ? "Unpin" : "Pin to keep it in view"}
        aria-label={pinLabel}
        onClick={() => onTogglePin(symbol)}
        className={cn(
          symbol.pinned
            ? "text-primary"
            : "opacity-0 group-hover:opacity-100 focus-visible:opacity-100",
        )}
      >
        {symbol.pinned ? <PinOff /> : <Pin />}
      </HintButton>
    </PaneRow>
  );
}

export function ContextList({ symbols, stepId, ...handlers }: ContextListProps) {
  const [filter, setFilter] = useState<ContextFilter>({ view: "all", shown: ALL_KIND_GROUPS });
  const visible = visibleSymbols(symbols, stepId, filter);
  return (
    <div className="flex flex-col gap-4">
      <TrailButtons {...handlers} />
      <FilterBar filter={filter} onChange={setFilter} />
      {visible.length === 0 ? (
        <EmptyState emoji="🧭">
          Click any name in the diff to peek it. It lands here so you can find it again.
        </EmptyState>
      ) : (
        <ul className="flex flex-col gap-0.5">
          {visible.map((symbol) => (
            <SymbolRow
              key={`${symbol.path}:${symbol.line}:${symbol.name}`}
              symbol={symbol}
              onOpen={handlers.onOpen}
              onTogglePin={handlers.onTogglePin}
            />
          ))}
        </ul>
      )}
    </div>
  );
}
