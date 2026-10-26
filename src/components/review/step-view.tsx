"use client";

import { ChevronRight, FileCode2 } from "lucide-react";
import { useState } from "react";
import { cn } from "cn";
import { PathLabel } from "@/components/common/path-label";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { PreparedFile } from "@/lib/review/prepare";
import type { Hotspot, Note, NoteKind, Step, StepFile } from "@/lib/types";
import { CodeLine, type LineHandlers } from "./code-line";
import { hunkElementId } from "./hunk-index";
import { lineElementId, type LineTarget } from "./locate";
import { NoteComposer } from "./note-composer";

const NO_LINKS = new Set<string>();

export type StepViewContext = {
  files: Map<string, PreparedFile>;
  linkable: Set<string>;
  hotspots: Hotspot[];
  notes: Note[];
  composer: LineTarget | null;
  activeHunkId: string | null;
  handlers: LineHandlers & {
    onSaveNote: (target: LineTarget, kind: NoteKind, body: string) => void;
    onCancelNote: () => void;
  };
};

function FileHeader({ file }: { file: PreparedFile }) {
  return (
    <div className="sticky top-0 z-10 flex items-center justify-between gap-4 border-b bg-card px-4 py-2.5 font-sans">
      <span className="flex min-w-0 items-center gap-2">
        <FileCode2 size={14} className="shrink-0 text-muted-foreground" />
        {file.status === "renamed" && file.oldPath && (
          <>
            <PathLabel path={file.oldPath} className="text-sm opacity-60" />
            <span className="text-muted-foreground">→</span>
          </>
        )}
        <PathLabel path={file.path} className="text-sm" />
      </span>
      <span className="flex shrink-0 items-center gap-2 font-mono text-xs">
        <span className="text-add-foreground">+{file.additions}</span>
        <span className="text-del-foreground">−{file.deletions}</span>
        <Badge variant="outline">{file.status}</Badge>
      </span>
    </div>
  );
}

function HunkBlock({
  file,
  hunkIndex,
  context,
}: {
  file: PreparedFile;
  hunkIndex: number;
  context: StepViewContext;
}) {
  const hunk = file.hunks[hunkIndex];
  const highlighted = file.highlighted[hunkIndex] ?? [];
  const id = hunkElementId(file.path, hunkIndex);
  const active = context.activeHunkId === id;
  return (
    <div
      id={id}
      className={cn(
        "scroll-mt-24 border-l-2 transition-colors duration-150",
        active ? "border-primary" : "border-transparent",
      )}
    >
      <div className="bg-muted px-4 py-1 text-muted-foreground">
        @@ {hunk.oldStart} → {hunk.newStart} {hunk.header}
      </div>
      {hunk.lines.map((line, lineIndex) => {
        const lineNumber = line.newLine;
        const target = lineNumber !== null ? { path: file.path, line: lineNumber } : null;
        const composing =
          target && context.composer?.path === target.path && context.composer.line === target.line;
        return (
          <div key={lineIndex}>
            <CodeLine
              path={file.path}
              hunkIndex={hunkIndex}
              lineIndex={lineIndex}
              line={line}
              tokens={highlighted[lineIndex] ?? [{ text: line.text }]}
              linkable={file.navigable ? context.linkable : NO_LINKS}
              hotspots={context.hotspots.filter(
                (hotspot) =>
                  hotspot.path === file.path && lineNumber !== null && hotspot.line === lineNumber,
              )}
              notes={context.notes.filter(
                (note) =>
                  note.path === file.path && note.line === lineNumber && lineNumber !== null,
              )}
              elementId={target ? lineElementId(target) : undefined}
              handlers={context.handlers}
            />
            {composing && target && (
              <NoteComposer
                onSave={(kind, body) => context.handlers.onSaveNote(target, kind, body)}
                onCancel={context.handlers.onCancelNote}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

function FileBlock({
  stepFile,
  context,
  collapsed,
}: {
  stepFile: StepFile;
  context: StepViewContext;
  collapsed: boolean;
}) {
  const [expanded, setExpanded] = useState(!collapsed);
  const file = context.files.get(stepFile.path);
  if (!file) return null;
  const empty = file.binary || stepFile.hunkIndexes.length === 0;
  return (
    <Card className="gap-0 overflow-clip py-0">
      <FileHeader file={file} />
      {!expanded ? (
        <Button
          variant="ghost"
          onClick={() => setExpanded(true)}
          className="h-auto w-full justify-start rounded-none px-4 py-3 font-normal text-muted-foreground"
        >
          <ChevronRight /> Collapsed: usually safe to skim. Show anyway
        </Button>
      ) : empty ? (
        <p className="px-4 py-3 text-sm text-muted-foreground">
          {file.binary ? "Binary file." : "No content changes (rename or mode change)."}
        </p>
      ) : (
        <div className="animate-step-enter font-mono text-code">
          {stepFile.hunkIndexes.map((hunkIndex) => (
            <HunkBlock key={hunkIndex} file={file} hunkIndex={hunkIndex} context={context} />
          ))}
        </div>
      )}
    </Card>
  );
}

export function StepView({ step, context }: { step: Step; context: StepViewContext }) {
  return (
    <div className="flex flex-col gap-4">
      {step.files.map((stepFile) => (
        <FileBlock
          key={`${step.id}:${stepFile.path}`}
          stepFile={stepFile}
          context={context}
          collapsed={step.role === "generated"}
        />
      ))}
    </div>
  );
}
