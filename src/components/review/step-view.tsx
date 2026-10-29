"use client";

import { ChevronRight, FileCode2, FoldVertical, UnfoldVertical } from "lucide-react";
import { memo, useEffect, useMemo, useState } from "react";
import { cn } from "cn";
import { PathLabel } from "@/components/common/path-label";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { AssistAction } from "@/lib/assist-protocol";
import type { PreparedFile } from "@/lib/review/prepare";
import type {
  DiffLine,
  DiffSide,
  Note,
  NoteTag,
  ReferenceCount,
  Step,
  StepFile,
  SymbolPosition,
} from "@/lib/types";
import { CodeLine, type LineHandlers } from "./code-line";
import { ContextGapView } from "./context-gap-view";
import { fileLayout, gapContaining, type LayoutItem } from "./context-gaps";
import { FileActionsButton } from "./file-actions-button";
import type { DisplayHotspot } from "./hotspot-list";
import { hunkElementId } from "./hunk-index";
import type { Thread } from "./conversation-threads";
import { indexByLine, linesAt, type FileLine } from "./line-index";
import { isInTarget, isSameLine, lineElementId, noteTargetOf, type LineTarget } from "./locate";
import { NoteComposer } from "./note-composer";
import { occurrenceAt, type Occurrences } from "./occurrences";
import { ReferenceLens } from "./reference-lens";
import { useFileLines, type FileLoad, type LoadFile } from "./use-file-lines";

export type StepViewContext = {
  files: Map<string, PreparedFile>;
  hotspots: DisplayHotspot[];
  checkedHotspots: string[];
  notes: Note[];
  threads: Thread[];
  composer: LineTarget | null;
  landed: LineTarget | null;
  occurrences: Occurrences | null;
  activeHunkId: string | null;
  referenceCounts: ReadonlyMap<string, ReferenceCount[]>;
  onAskFile: ((path: string, action: AssistAction) => void) | null;
  loadFile: LoadFile;
  handlers: LineHandlers & {
    onSaveNote: (target: LineTarget, tag: NoteTag, body: string) => void;
    onCancelNote: () => void;
    onShowReferences: (position: SymbolPosition) => void;
    onOpenConversation: () => void;
  };
};

function isComposingAt(composer: LineTarget | null, target: LineTarget | null): boolean {
  return target !== null && isSameLine(composer, target.path, target.line, target.side);
}

function isLandedAt(landed: LineTarget | null, target: LineTarget | null): boolean {
  return target !== null && isInTarget(landed, target.path, target.line, target.side);
}

function lensAt(
  lenses: Map<number, ReferenceCount>,
  lineNumber: number | null,
): ReferenceCount | undefined {
  return lineNumber !== null ? lenses.get(lineNumber) : undefined;
}

type LineAnnotations = {
  hotspots: ReadonlyMap<string, DisplayHotspot[]>;
  notes: ReadonlyMap<string, Note[]>;
  removedNotes: ReadonlyMap<string, Note[]>;
  threads: ReadonlyMap<string, Thread[]>;
};

function notePosition(note: Note): FileLine | null {
  return note.path === null || note.line === null ? null : { path: note.path, line: note.line };
}

function notesOnSide(notes: Note[], side: DiffSide): Note[] {
  return notes.filter((note) => note.side === side);
}

function annotationsOf(context: StepViewContext): LineAnnotations {
  return {
    hotspots: indexByLine(context.hotspots, (hotspot) =>
      hotspot.line === null ? null : { path: hotspot.path, line: hotspot.line },
    ),
    notes: indexByLine(notesOnSide(context.notes, "new"), notePosition),
    removedNotes: indexByLine(notesOnSide(context.notes, "old"), notePosition),
    threads: indexByLine(
      context.threads.filter((thread) => thread.root.side === "RIGHT"),
      (thread) =>
        thread.root.line === null ? null : { path: thread.root.path, line: thread.root.line },
    ),
  };
}

function notesOn(annotations: LineAnnotations, path: string, line: DiffLine): Note[] {
  if (line.newLine !== null) return linesAt(annotations.notes, path, line.newLine);
  return linesAt(annotations.removedNotes, path, line.oldLine);
}

function lensesOf(
  referenceCounts: StepViewContext["referenceCounts"],
  path: string,
): Map<number, ReferenceCount> {
  const counts = referenceCounts.get(path) ?? [];
  return new Map(counts.map((count) => [count.line, count]));
}

type WholeFileToggle = { wholeFile: boolean; onToggle: () => void } | null;

function WholeFileButton({ toggle }: { toggle: NonNullable<WholeFileToggle> }) {
  return (
    <Button variant="ghost" size="xs" onClick={toggle.onToggle} aria-pressed={toggle.wholeFile}>
      {toggle.wholeFile ? <FoldVertical /> : <UnfoldVertical />}
      {toggle.wholeFile ? "Show changes only" : "Show whole file"}
    </Button>
  );
}

function FileHeader({
  file,
  onAskFile,
  wholeFileToggle,
}: {
  file: PreparedFile;
  onAskFile: StepViewContext["onAskFile"];
  wholeFileToggle: WholeFileToggle;
}) {
  return (
    <div className="sticky top-0 z-10 flex min-h-12 flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b bg-card px-4 py-2 font-sans">
      <span className="flex min-w-0 items-center gap-2 max-sm:basis-full">
        <FileCode2 className="size-4 shrink-0 text-muted-foreground" />
        {file.status === "renamed" && file.oldPath && (
          <>
            <PathLabel path={file.oldPath} truncate className="text-sm opacity-60" />
            <span className="text-muted-foreground">→</span>
          </>
        )}
        <PathLabel path={file.path} truncate className="text-sm" />
      </span>
      <span className="flex shrink-0 items-center gap-3 text-sm tabular-nums">
        {wholeFileToggle && <WholeFileButton toggle={wholeFileToggle} />}
        {onAskFile && !file.binary && (
          <FileActionsButton onAsk={(action) => onAskFile(file.path, action)} />
        )}
        <span className="flex gap-1.5 font-medium">
          <span className="text-add-foreground">+{file.additions}</span>
          <span className="text-del-foreground">−{file.deletions}</span>
        </span>
        <Badge variant="outline">{file.status}</Badge>
      </span>
    </div>
  );
}

const NO_IDS: string[] = [];

function HunkBlock({
  file,
  hunkIndex,
  anchored,
  context,
  lenses,
  annotations,
}: {
  file: PreparedFile;
  hunkIndex: number;
  anchored: boolean;
  context: StepViewContext;
  lenses: Map<number, ReferenceCount>;
  annotations: LineAnnotations;
}) {
  const hunk = file.hunks[hunkIndex];
  const tokensByLine = useMemo(() => {
    const highlighted = file.highlighted[hunkIndex] ?? [];
    return hunk.lines.map((line, lineIndex) => highlighted[lineIndex] ?? [{ text: line.text }]);
  }, [file.highlighted, hunk, hunkIndex]);
  const id = hunkElementId(file.path, hunkIndex);
  const active = anchored && context.activeHunkId === id;
  const showReferences = ({ name, line, character }: ReferenceCount) =>
    context.handlers.onShowReferences({ name, path: file.path, line, character, side: "new" });
  return (
    <div
      id={anchored ? id : undefined}
      className={cn(
        "scroll-mt-24 border-l-2 transition-colors duration-calm",
        active ? "border-primary" : "border-transparent",
      )}
    >
      <div className="bg-muted px-4 py-1.5 text-muted-foreground wrap-anywhere">
        @@ {hunk.oldStart} → {hunk.newStart} {hunk.header}
      </div>
      {hunk.lines.map((line, lineIndex) => {
        const target = noteTargetOf(file.path, line);
        const composer = isComposingAt(context.composer, target) ? context.composer : null;
        const landed = isLandedAt(context.landed, target);
        const lens = lensAt(lenses, line.newLine);
        const hotspots = linesAt(annotations.hotspots, file.path, line.newLine);
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
              tokens={tokensByLine[lineIndex]}
              linked={file.navigable}
              hotspots={hotspots}
              checkedHotspots={hotspots.length > 0 ? context.checkedHotspots : NO_IDS}
              notes={notesOn(annotations, file.path, line)}
              threadCount={linesAt(annotations.threads, file.path, line.newLine).length}
              onOpenThreads={context.handlers.onOpenConversation}
              elementId={anchored && target ? lineElementId(target) : undefined}
              landed={landed ? context.landed : null}
              occurrence={occurrenceAt(context.occurrences, file.path, line.newLine)}
              occurrenceName={context.occurrences?.name ?? null}
              handlers={context.handlers}
            />
            {composer && (
              <NoteComposer
                onSave={(tag, body) => context.handlers.onSaveNote(composer, tag, body)}
                onCancel={context.handlers.onCancelNote}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

function canExpand(file: PreparedFile): boolean {
  return !file.binary && (file.status === "modified" || file.status === "renamed");
}

function layoutOf(
  file: PreparedFile,
  stepFile: StepFile,
  wholeFile: boolean,
  load: FileLoad,
): LayoutItem[] {
  if (!canExpand(file)) return stepFile.hunkIndexes.map((index) => ({ kind: "hunk", index }));
  const shown = wholeFile ? file.hunks.map((_, index) => index) : stepFile.hunkIndexes;
  return fileLayout(file.hunks, shown, load.lines?.tokens.length ?? null);
}

function landedGapIn(
  layout: LayoutItem[],
  file: PreparedFile,
  landed: LineTarget | null,
): number | null {
  return landed?.path === file.path ? gapContaining(layout, landed.line) : null;
}

function FileBody({
  file,
  stepFile,
  context,
  wholeFile,
  annotations,
}: {
  file: PreparedFile;
  stepFile: StepFile;
  context: StepViewContext;
  wholeFile: boolean;
  annotations: LineAnnotations;
}) {
  const { load, request } = useFileLines(context.loadFile, file.path);
  const lenses = useMemo(
    () => lensesOf(context.referenceCounts, file.path),
    [context.referenceCounts, file.path],
  );
  const [openGaps, setOpenGaps] = useState<ReadonlySet<number>>(new Set());
  const layout = layoutOf(file, stepFile, wholeFile, load);
  const landedGap = landedGapIn(layout, file, context.landed);
  const isOpen = (from: number) => wholeFile || openGaps.has(from) || from === landedGap;
  const anyOpen = wholeFile || openGaps.size > 0 || landedGap !== null;
  useEffect(() => {
    if (wholeFile || landedGap !== null) request();
  }, [wholeFile, landedGap, request]);
  const expand = (from: number) => {
    setOpenGaps((current) => new Set(current).add(from));
    request();
  };
  return (
    <div className="animate-step-enter font-mono text-code">
      {layout.map((item) =>
        item.kind === "hunk" ? (
          <HunkBlock
            key={`hunk:${item.index}`}
            file={file}
            hunkIndex={item.index}
            anchored={stepFile.hunkIndexes.includes(item.index)}
            context={context}
            lenses={lenses}
            annotations={annotations}
          />
        ) : (
          <ContextGapView
            key={`gap:${item.gap.from}`}
            gap={item.gap}
            open={isOpen(item.gap.from)}
            load={load}
            onExpand={() => expand(item.gap.from)}
            path={file.path}
            landed={context.landed}
            linked={file.navigable}
            handlers={context.handlers}
          />
        ),
      )}
      {anyOpen && load.lines?.truncated && (
        <p className="px-4 py-2 font-sans text-sm text-muted-foreground">
          The file is cut at 300 KB.
        </p>
      )}
    </div>
  );
}

function FileBlock({
  stepFile,
  context,
  collapsed,
  annotations,
}: {
  stepFile: StepFile;
  context: StepViewContext;
  collapsed: boolean;
  annotations: LineAnnotations;
}) {
  const [expanded, setExpanded] = useState(!collapsed);
  const [wholeFile, setWholeFile] = useState(false);
  const file = context.files.get(stepFile.path);
  if (!file) return null;
  const empty = file.binary || stepFile.hunkIndexes.length === 0;
  const wholeFileToggle =
    expanded && !empty && canExpand(file)
      ? { wholeFile, onToggle: () => setWholeFile(!wholeFile) }
      : null;
  return (
    <Card className="gap-0 overflow-clip py-0">
      <FileHeader file={file} onAskFile={context.onAskFile} wholeFileToggle={wholeFileToggle} />
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
        <FileBody
          file={file}
          stepFile={stepFile}
          context={context}
          wholeFile={wholeFile}
          annotations={annotations}
        />
      )}
    </Card>
  );
}

export const StepView = memo(function StepView({
  step,
  context,
}: {
  step: Step;
  context: StepViewContext;
}) {
  const annotations = useMemo(() => annotationsOf(context), [context]);
  return (
    <div className="flex flex-col gap-4">
      {step.files.map((stepFile) => (
        <FileBlock
          key={`${step.id}:${stepFile.path}`}
          stepFile={stepFile}
          context={context}
          collapsed={step.role === "generated"}
          annotations={annotations}
        />
      ))}
    </div>
  );
});
