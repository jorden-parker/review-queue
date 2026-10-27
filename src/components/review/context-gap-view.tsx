"use client";

import { ChevronsUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Token } from "@/lib/highlight";
import type { DiffLine } from "@/lib/types";
import { ContextLine, type LineHandlers } from "./code-line";
import type { ContextGap } from "./context-gaps";
import type { FileLoad } from "./use-file-lines";

type ContextGapViewProps = {
  gap: ContextGap;
  open: boolean;
  load: FileLoad;
  onExpand: () => void;
  path: string;
  linked: boolean;
  handlers: LineHandlers;
};

function contextLine(newLine: number, oldOffset: number, tokens: Token[]): DiffLine {
  const text = tokens.map((token) => token.text).join("");
  return { kind: "context", text, oldLine: newLine + oldOffset, newLine };
}

function expandLabel(gap: ContextGap, load: FileLoad): string {
  if (load.failed) return "Couldn't load the file. Try again";
  if (load.loading) return "Loading…";
  if (gap.to === null) return "Expand to end of file";
  const count = gap.to - gap.from + 1;
  return `Expand ${count} ${count === 1 ? "line" : "lines"}`;
}

function lineNumbers(from: number, to: number): number[] {
  return Array.from({ length: to - from + 1 }, (_, offset) => from + offset);
}

export function ContextGapView({
  gap,
  open,
  load,
  onExpand,
  path,
  linked,
  handlers,
}: ContextGapViewProps) {
  const lastLine = gap.to ?? load.lines?.tokens.length ?? null;
  if (lastLine !== null && lastLine < gap.from) return null;
  if (open && load.lines && lastLine !== null) {
    const tokens = load.lines.tokens;
    return lineNumbers(gap.from, lastLine).map((newLine) => (
      <ContextLine
        key={newLine}
        path={path}
        line={contextLine(newLine, gap.oldOffset, tokens[newLine - 1] ?? [])}
        tokens={tokens[newLine - 1] ?? []}
        linked={linked}
        handlers={handlers}
      />
    ));
  }
  return (
    <Button
      variant="ghost"
      size="xs"
      disabled={load.loading}
      onClick={onExpand}
      className="h-auto w-full justify-start rounded-none bg-muted/50 px-4 py-1 font-sans font-normal text-muted-foreground"
    >
      <ChevronsUpDown /> {expandLabel({ ...gap, to: lastLine }, load)}
    </Button>
  );
}
