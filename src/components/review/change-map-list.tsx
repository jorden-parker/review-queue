"use client";

import { Check } from "lucide-react";
import { cn } from "cn";
import { EmptyState } from "@/components/common/empty-state";
import { PaneRow } from "@/components/common/pane-row";
import { PathLabel } from "@/components/common/path-label";
import { Badge } from "@/components/ui/badge";
import type { ChangeNode } from "@/lib/types";
import type { MapRow, MapSection } from "./map-rows";

type NodePart = { part: string; weight: string };

type ChangeMapListProps = {
  sections: MapSection[];
  onOpen: (node: ChangeNode) => void;
  parts?: ReadonlyMap<string, NodePart>;
};

const INDENT_BY_DEPTH = ["pl-0", "pl-4", "pl-8", "pl-12", "pl-16"];

export function ChangeMapList({ sections, onOpen, parts }: ChangeMapListProps) {
  if (sections.length === 0) {
    return <EmptyState emoji="🗺️">No changed symbols to map.</EmptyState>;
  }
  return (
    <div className="flex flex-col gap-5">
      {sections.map((section) => (
        <section key={section.id} className="flex flex-col gap-1">
          <h3 className="font-medium text-sm">{section.title}</h3>
          <ol>
            {section.rows.map((row) => (
              <MapRowItem key={row.key} row={row} onOpen={onOpen} part={parts?.get(row.node.id)} />
            ))}
          </ol>
        </section>
      ))}
    </div>
  );
}

function MapRowItem({
  row,
  onOpen,
  part,
}: {
  row: MapRow;
  onOpen: (node: ChangeNode) => void;
  part: NodePart | undefined;
}) {
  const { node } = row;
  return (
    <PaneRow active={row.current} className={mutedClass(row, part)}>
      <button
        type="button"
        aria-current={row.current ? "step" : undefined}
        onClick={() => onOpen(node)}
        className={cn(
          "flex w-full min-w-0 cursor-pointer flex-col items-start gap-1 text-left",
          indentClass(row.depth),
        )}
      >
        <RowHeading row={row} />
        {part ? <span className="text-xs text-muted-foreground">{part.part}</span> : null}
        <PathLabel path={node.path} />
      </button>
    </PaneRow>
  );
}

function indentClass(depth: number): string {
  return INDENT_BY_DEPTH[depth] ?? INDENT_BY_DEPTH[INDENT_BY_DEPTH.length - 1];
}

function mutedClass(row: MapRow, part: NodePart | undefined): string | undefined {
  const muted = row.done || part?.weight === "incidental";
  return muted ? "text-muted-foreground" : undefined;
}

function RowHeading({ row }: { row: MapRow }) {
  return (
    <span className="flex max-w-full flex-wrap items-center gap-2">
      {row.done ? <Check aria-hidden className="size-3.5 shrink-0" /> : null}
      {row.kind === "test" ? (
        <span className="text-xs text-muted-foreground">tested by</span>
      ) : null}
      <span className="wrap-anywhere font-mono text-sm">{row.node.name ?? "file changes"}</span>
      <Badge variant="outline" className="h-auto whitespace-normal wrap-anywhere">
        {row.node.role}
      </Badge>
    </span>
  );
}
