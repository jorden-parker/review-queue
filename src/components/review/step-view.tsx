"use client";

import { ChevronRight, FileCode2 } from "lucide-react";
import { useState } from "react";
import { cn } from "cn";
import { PathLabel } from "@/components/common/path-label";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { AssistAction } from "@/lib/assist-protocol";
import type { PreparedFile } from "@/lib/review/prepare";
import type { Note, NoteKind, ReferenceCount, Step, StepFile, SymbolPosition } from "@/lib/types";
import { CodeLine, type LineHandlers } from "./code-line";
import { FileAskButton } from "./file-ask-button";
import type { DisplayHotspot } from "./hotspot-list";
import { hunkElementId } from "./hunk-index";
import { isInTarget, isSameLine, lineElementId, type LineTarget } from "./locate";
import { NoteComposer } from "./note-composer";
import { occurrenceAt, type Occurrences } from "./occurrences";
import { ReferenceLens } from "./reference-lens";

export type StepViewContext = {
  files: Map<string, PreparedFile>;
  hotspots: DisplayHotspot[];
  checkedHotspots: string[];
  notes: Note[];
  composer: LineTarget | null;
  landed: LineTarget | null;
  occurrences: Occurrences | null;
  activeHunkId: string | null;
  referenceCounts: ReadonlyMap<string, ReferenceCount[]>;
  onAskFile: ((path: string, action: AssistAction) => void) | null;
  handlers: LineHandlers & {
    onSaveNote: (target: LineTarget, kind: NoteKind, body: string) => void;
    onCancelNote: () => void;
    onShowReferences: (position: SymbolPosition) => void;
  };
};

function lensesOf(context: StepViewContext, path: string): Map<number, ReferenceCount> {
  const counts = context.referenceCounts.get(path) ?? [];
  return new Map(counts.map((count) => [count.line, count]));
}

function FileHeader({
  file,
  onAskFile,
}: {
  file: PreparedFile;
  onAskFile: StepViewContext["onAskFile"];
}) {
  return (
    <div className="sticky top-0 z-10 flex flex-wrap items-center justify-between gap-x-4 gap-y-1.5 border-b bg-card px-3 py-2.5 font-sans sm:px-4">
      <span className="flex min-w-0 items-center gap-2 max-sm:basis-full">
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
        {onAskFile && !file.binary && (
          <FileAskButton onAsk={(action) => onAskFile(file.path, action)} />
        )}
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
  const lenses = lensesOf(context, file.path);
  const showReferences = ({ name, line, character }: ReferenceCount) =>
    context.handlers.onShowReferences({ name, path: file.path, line, character, side: "new" });
  return (
    <div
      id={id}
      className={cn(
        "scroll-mt-24 border-l-2 transition-colors duration-150",
        active ? "border-primary" : "border-transparent",
      )}
    >
      <div className="bg-muted px-3 py-1 text-muted-foreground wrap-anywhere sm:px-4">
        @@ {hunk.oldStart} → {hunk.newStart} {hunk.header}
      </div>
      {hunk.lines.map((line, lineIndex) => {
        const lineNumber = line.newLine;
        const target = lineNumber !== null ? { path: file.path, line: lineNumber } : null;
        const composing = target && isSameLine(context.composer, target.path, target.line);
        const landed = target && isInTarget(context.landed, target.path, target.line);
        const lens = lineNumber !== null ? lenses.get(lineNumber) : undefined;
        return (
          <div key={lineIndex}>
            {lens && (
              <ReferenceLens reference={lens} lineText={line.text} onShow={showReferences} />
            )}
            <CodeLine
              path={file.path}
              hunkIndex={hunkIndex}
              lineIndex={lineIndex}
              line={line}
              tokens={highlighted[lineIndex] ?? [{ text: line.text }]}
              linked={file.navigable}
              hotspots={context.hotspots.filter(
                (hotspot) =>
                  hotspot.path === file.path && lineNumber !== null && hotspot.line === lineNumber,
              )}
              checkedHotspots={context.checkedHotspots}
              notes={context.notes.filter(
                (note) =>
                  note.path === file.path && note.line === lineNumber && lineNumber !== null,
              )}
              elementId={target ? lineElementId(target) : undefined}
              landed={landed ? context.landed : null}
              occurrence={occurrenceAt(context.occurrences, file.path, lineNumber)}
              occurrenceName={context.occurrences?.name ?? null}
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
      <FileHeader file={file} onAskFile={context.onAskFile} />
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
