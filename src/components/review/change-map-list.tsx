"use client";

import { Check, ChevronRight } from "lucide-react";
import { cn } from "cn";
import { type KeyboardEvent, type Ref, useState } from "react";
import { EmptyState } from "@/components/common/empty-state";
import { PaneRow } from "@/components/common/pane-row";
import { PathLabel } from "@/components/common/path-label";
import { Badge } from "@/components/ui/badge";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import type { ChangeNode } from "@/lib/types";
import { nextStopIndex } from "./map-keys";
import {
  initiallyCollapsed,
  type MapFilters,
  type MapRow,
  type MapSection,
  type NodePart,
  visibleRows,
} from "./map-rows";

type ChangeMapListProps = {
  sections: MapSection[];
  onOpen: (node: ChangeNode) => void;
  parts?: ReadonlyMap<string, NodePart>;
  listRef?: Ref<HTMLDivElement>;
};

type Geometry = { pad: string; station: string; tick: string };

const GEOMETRY_BY_DEPTH: Geometry[] = [
  { pad: "pl-5", station: "left-2", tick: "w-0" },
  { pad: "pl-9", station: "left-6", tick: "w-4" },
  { pad: "pl-13", station: "left-10", tick: "w-8" },
  { pad: "pl-17", station: "left-14", tick: "w-12" },
  { pad: "pl-21", station: "left-18", tick: "w-16" },
];

const STATION_SIZE_BY_WEIGHT: Record<string, string> = {
  essential: "size-3",
  supporting: "size-2.5",
  incidental: "size-2",
};

const FILTER_LABELS: Record<keyof MapFilters, string> = {
  hideRead: "Hide read",
  hideIncidental: "Hide incidental",
};

const NAVIGABLE = "[data-map-stop],[data-map-header]";

export function ChangeMapList({ sections, onOpen, parts, listRef }: ChangeMapListProps) {
  const [collapsed, setCollapsed] = useState(() => initiallyCollapsed(sections));
  const [filters, setFilters] = useState<MapFilters>({ hideRead: false, hideIncidental: false });
  const [highlightedId, setHighlightedId] = useState<string | null>(null);
  if (sections.length === 0) {
    return <EmptyState emoji="🗺️">No changed symbols to map.</EmptyState>;
  }
  const setOpen = (id: string, open: boolean) =>
    setCollapsed((current) => withMembership(current, id, !open));
  return (
    <div className="flex flex-col gap-4">
      <MapToolbar filters={filters} onChange={setFilters} canHideIncidental={parts !== undefined} />
      <div
        ref={listRef}
        className="flex flex-col gap-4"
        onKeyDown={(event) => handleListKey(event, setOpen)}
      >
        {sections.map((section) => (
          <MapThread
            key={section.id}
            section={section}
            rows={visibleRows(section.rows, filters, parts)}
            open={!collapsed.has(section.id)}
            onToggle={() => setOpen(section.id, collapsed.has(section.id))}
            stop={{ onOpen, parts, highlightedId, onHighlight: setHighlightedId }}
          />
        ))}
      </div>
    </div>
  );
}

function withMembership(set: ReadonlySet<string>, id: string, member: boolean): Set<string> {
  const next = new Set(set);
  if (member) next.add(id);
  else next.delete(id);
  return next;
}

function handleListKey(
  event: KeyboardEvent<HTMLDivElement>,
  setOpen: (id: string, open: boolean) => void,
) {
  const target = event.target as HTMLElement;
  const headerId = target.dataset.mapHeader;
  if (headerId && (event.key === "ArrowLeft" || event.key === "ArrowRight")) {
    event.preventDefault();
    setOpen(headerId, event.key === "ArrowRight");
    return;
  }
  if (target.dataset.mapStop !== undefined && event.key === "ArrowLeft") {
    event.preventDefault();
    target.closest("section")?.querySelector<HTMLElement>("[data-map-header]")?.focus();
    return;
  }
  moveFocus(event, target);
}

function moveFocus(event: KeyboardEvent<HTMLDivElement>, target: HTMLElement) {
  const items = [...event.currentTarget.querySelectorAll<HTMLElement>(NAVIGABLE)];
  const next = nextStopIndex(items.indexOf(target), event.key, items.length);
  if (next === null) return;
  event.preventDefault();
  items[next].focus();
}

function MapToolbar({
  filters,
  onChange,
  canHideIncidental,
}: {
  filters: MapFilters;
  onChange: (filters: MapFilters) => void;
  canHideIncidental: boolean;
}) {
  const offered: (keyof MapFilters)[] = canHideIncidental
    ? ["hideRead", "hideIncidental"]
    : ["hideRead"];
  return (
    <ToggleGroup
      type="multiple"
      size="sm"
      value={offered.filter((key) => filters[key])}
      onValueChange={(on) =>
        onChange({
          hideRead: on.includes("hideRead"),
          hideIncidental: on.includes("hideIncidental"),
        })
      }
      className="flex-wrap"
    >
      {offered.map((key) => (
        <ToggleGroupItem key={key} value={key} className="text-xs">
          {FILTER_LABELS[key]}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}

type StopContext = {
  onOpen: (node: ChangeNode) => void;
  parts: ReadonlyMap<string, NodePart> | undefined;
  highlightedId: string | null;
  onHighlight: (id: string | null) => void;
};

function MapThread({
  section,
  rows,
  open,
  onToggle,
  stop,
}: {
  section: MapSection;
  rows: MapRow[];
  open: boolean;
  onToggle: () => void;
  stop: StopContext;
}) {
  const linked = new Set(
    section.rows.find((row) => row.node.id === stop.highlightedId)?.linkedIds ?? [],
  );
  return (
    <section className="flex flex-col gap-1">
      <ThreadHeader section={section} open={open} onToggle={onToggle} />
      {open ? (
        <ThreadStops rows={rows} connected={section.connected} linked={linked} stop={stop} />
      ) : null}
    </section>
  );
}

function ThreadHeader({
  section,
  open,
  onToggle,
}: {
  section: MapSection;
  open: boolean;
  onToggle: () => void;
}) {
  const finished = section.readCount === section.total;
  return (
    <div className="flex items-baseline justify-between gap-3">
      <h3 className="min-w-0 font-medium text-sm">
        <button
          type="button"
          data-map-header={section.id}
          aria-expanded={open}
          onClick={onToggle}
          className="flex min-w-0 cursor-pointer items-center gap-1 rounded-md text-left"
        >
          <ChevronRight
            aria-hidden
            className={cn(
              "size-3.5 shrink-0 text-muted-foreground transition-transform duration-calm ease-calm motion-reduce:transition-none",
              open && "rotate-90",
            )}
          />
          <span className="wrap-anywhere">{section.title}</span>
        </button>
      </h3>
      <span className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground tabular-nums">
        {finished ? <Check aria-hidden className="size-3.5 text-primary" /> : null}
        {section.readCount} of {section.total} read
      </span>
    </div>
  );
}

function ThreadStops({
  rows,
  connected,
  linked,
  stop,
}: {
  rows: MapRow[];
  connected: boolean;
  linked: ReadonlySet<string>;
  stop: StopContext;
}) {
  if (rows.length === 0) {
    return <p className="pl-5 text-xs text-muted-foreground">All stops hidden by filters.</p>;
  }
  return (
    <ol>
      {rows.map((row, index) => (
        <MapStop
          key={row.key}
          row={row}
          trunk={connected ? trunkClass(index, rows.length) : null}
          linked={linked.has(row.node.id)}
          stop={stop}
        />
      ))}
    </ol>
  );
}

function trunkClass(index: number, count: number): string | null {
  if (count === 1) return null;
  if (index === 0) return "top-4.5 bottom-0";
  if (index === count - 1) return "top-0 h-4.5";
  return "inset-y-0";
}

function MapStop({
  row,
  trunk,
  linked,
  stop,
}: {
  row: MapRow;
  trunk: string | null;
  linked: boolean;
  stop: StopContext;
}) {
  const part = stop.parts?.get(row.node.id);
  const geometry = geometryFor(row.depth);
  return (
    <PaneRow
      active={row.current}
      className={cn("relative", isMuted(row, part, linked) && "text-muted-foreground")}
    >
      {trunk ? (
        <span
          aria-hidden
          data-map-line="trunk"
          className={cn("absolute left-3.5 w-px bg-muted-foreground/40", trunk)}
        />
      ) : null}
      <StationMark row={row} geometry={geometry} weight={part?.weight} linked={linked} />
      <StopButton row={row} part={part} pad={geometry.pad} linked={linked} stop={stop} />
    </PaneRow>
  );
}

function isMuted(row: MapRow, part: NodePart | undefined, linked: boolean): boolean {
  return !linked && (row.done || part?.weight === "incidental");
}

function StopButton({
  row,
  part,
  pad,
  linked,
  stop,
}: {
  row: MapRow;
  part: NodePart | undefined;
  pad: string;
  linked: boolean;
  stop: StopContext;
}) {
  const { node } = row;
  return (
    <button
      type="button"
      data-map-stop
      data-state={row.done ? "read" : "unread"}
      data-linked={linked}
      aria-current={row.current ? "step" : undefined}
      aria-label={stopLabel(row)}
      onClick={() => stop.onOpen(node)}
      onMouseEnter={() => stop.onHighlight(node.id)}
      onMouseLeave={() => stop.onHighlight(null)}
      onFocus={() => stop.onHighlight(node.id)}
      onBlur={() => stop.onHighlight(null)}
      className={cn(
        "flex w-full min-w-0 cursor-pointer flex-col items-start gap-0.5 rounded-md text-left",
        pad,
      )}
    >
      <StopHeading row={row} />
      {part ? <span className="text-xs text-muted-foreground">{part.part}</span> : null}
      {row.showPath ? <PathLabel path={node.path} /> : null}
    </button>
  );
}

function geometryFor(depth: number): Geometry {
  return GEOMETRY_BY_DEPTH[depth] ?? GEOMETRY_BY_DEPTH[GEOMETRY_BY_DEPTH.length - 1];
}

function stopLabel(row: MapRow): string {
  const prefix = row.kind === "test" ? "tested by " : "";
  return `${prefix}${row.node.name ?? "file changes"}, ${row.node.path}`;
}

function StationMark({
  row,
  geometry,
  weight,
  linked,
}: {
  row: MapRow;
  geometry: Geometry;
  weight: string | undefined;
  linked: boolean;
}) {
  return (
    <>
      {row.depth > 0 ? (
        <span
          aria-hidden
          data-map-line="tick"
          className={cn(
            "absolute top-4.5 left-3.5",
            geometry.tick,
            row.kind === "test"
              ? "border-t border-dashed border-muted-foreground/40"
              : "h-px bg-muted-foreground/40",
          )}
        />
      ) : null}
      <span
        aria-hidden
        className={cn("absolute top-3 flex size-3 items-center justify-center", geometry.station)}
      >
        <span
          className={cn(
            "border-2 transition-shadow duration-calm motion-reduce:transition-none",
            STATION_SIZE_BY_WEIGHT[weight ?? "supporting"] ?? "size-2.5",
            row.kind === "entry" ? "rounded-xs" : "rounded-full",
            stationColour(row),
            linked && "ring-2 ring-primary/50",
          )}
        />
      </span>
    </>
  );
}

function stationColour(row: MapRow): string {
  if (row.current) return "border-marker bg-background ring-2 ring-marker/40";
  if (row.done) return "border-primary bg-primary";
  return "border-muted-foreground/60 bg-background";
}

function StopHeading({ row }: { row: MapRow }) {
  return (
    <span className="flex max-w-full flex-wrap items-center gap-2">
      {row.kind === "test" ? (
        <span className="text-xs text-muted-foreground">tested by</span>
      ) : null}
      <span className="wrap-anywhere font-mono text-sm">{row.node.name ?? "file changes"}</span>
      {row.showRole ? (
        <Badge variant="outline" className="h-auto whitespace-normal wrap-anywhere">
          {row.node.role}
        </Badge>
      ) : null}
    </span>
  );
}

export function focusCurrentStop(container: HTMLElement | null) {
  const stops = container?.querySelectorAll<HTMLElement>("[data-map-stop]");
  const current = container?.querySelector<HTMLElement>('[data-map-stop][aria-current="step"]');
  (current ?? stops?.[0])?.focus();
}
