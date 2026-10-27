"use client";

import { ChevronDown, ChevronRight } from "lucide-react";
import { useState } from "react";
import { cn } from "cn";
import { EmptyState } from "@/components/common/empty-state";
import { PathLabel } from "@/components/common/path-label";
import type { OutlineSymbol } from "@/lib/types";
import { type DiffLines, type OutlineRow, outlineRows } from "./outline-rows";
import { KIND_ICONS } from "./symbol-kind-icons";

export type OutlineFile = {
  path: string;
  symbols: OutlineSymbol[] | undefined;
  diff: DiffLines;
};

type OpenSymbol = (symbol: OutlineSymbol, shown: boolean) => void;

function toggled(keys: ReadonlySet<string>, key: string): Set<string> {
  const next = new Set(keys);
  if (!next.delete(key)) next.add(key);
  return next;
}

function ExpandToggle({ row, onToggle }: { row: OutlineRow; onToggle: () => void }) {
  if (!row.hasChildren) return <span className="w-5 shrink-0" />;
  const Chevron = row.expanded ? ChevronDown : ChevronRight;
  return (
    <button
      type="button"
      aria-label={`${row.expanded ? "Collapse" : "Expand"} ${row.symbol.name}`}
      onClick={onToggle}
      className="flex w-5 shrink-0 justify-center text-muted-foreground hover:text-foreground"
    >
      <Chevron size={14} />
    </button>
  );
}

function SymbolRow({
  row,
  onToggle,
  onOpen,
}: {
  row: OutlineRow;
  onToggle: () => void;
  onOpen: OpenSymbol;
}) {
  const Icon = KIND_ICONS[row.symbol.kind];
  return (
    <li
      role="treeitem"
      aria-level={row.depth + 1}
      aria-expanded={row.hasChildren ? row.expanded : undefined}
      aria-selected={false}
      style={{ paddingInlineStart: `${row.depth}rem` }}
      className="flex items-center rounded-lg transition-colors duration-calm hover:bg-muted"
    >
      <ExpandToggle row={row} onToggle={onToggle} />
      <button
        type="button"
        aria-label={[row.symbol.name, row.symbol.kind, row.changed && "changed"]
          .filter(Boolean)
          .join(" ")}
        onClick={() => onOpen(row.symbol, row.shown)}
        title={row.shown ? "Go to it in the diff" : "Peek it; it is outside this step's diff"}
        className="flex min-w-0 flex-1 items-center gap-1.5 py-1 pr-2 text-left text-sm"
      >
        <Icon size={14} className="shrink-0 text-primary" aria-hidden />
        <span className={cn("truncate font-mono", row.changed && "font-medium text-primary")}>
          {row.symbol.name}
        </span>
        <span className="text-xs text-muted-foreground">{row.symbol.kind}</span>
      </button>
    </li>
  );
}

function FileOutline({ file, onOpen }: { file: OutlineFile; onOpen: OpenSymbol }) {
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(new Set());
  const rows = file.symbols ? outlineRows(file.symbols, collapsed, file.diff) : [];
  return (
    <section className="flex flex-col gap-1">
      <PathLabel path={file.path} className="px-2 text-muted-foreground" />
      {file.symbols === undefined && <p className="px-2 text-xs text-muted-foreground">Loading…</p>}
      {file.symbols?.length === 0 && (
        <p className="px-2 text-xs text-muted-foreground">No symbols</p>
      )}
      {rows.length > 0 && (
        <ul role="tree" aria-label={`Outline of ${file.path}`} className="flex flex-col">
          {rows.map((row) => (
            <SymbolRow
              key={row.key}
              row={row}
              onToggle={() => setCollapsed((keys) => toggled(keys, row.key))}
              onOpen={onOpen}
            />
          ))}
        </ul>
      )}
    </section>
  );
}

export function OutlineList({ files, onOpen }: { files: OutlineFile[]; onOpen: OpenSymbol }) {
  if (files.length === 0) {
    return <EmptyState emoji="🗂️">No code files in this step to outline.</EmptyState>;
  }
  return (
    <div className="flex flex-col gap-4">
      {files.map((file) => (
        <FileOutline key={file.path} file={file} onOpen={onOpen} />
      ))}
    </div>
  );
}
