"use client";

import { MessageSquarePlus, Trash2 } from "lucide-react";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import type { LineRange } from "@/lib/assist-protocol";
import type { Token } from "@/lib/highlight";
import type { DiffLine, Note, SymbolPosition } from "@/lib/types";
import { CodeTokens, type IdentifierTarget } from "./code-tokens";
import { flagLineTint, HotspotFlag } from "./hotspot-flag";
import type { DisplayHotspot } from "./hotspot-list";
import type { LineTarget } from "./locate";
import { NoteKindBadge } from "./note-kind-badge";

export type LineHandlers = {
  onIdentifier: (position: SymbolPosition) => void;
  onHoverIdentifier: (position: SymbolPosition | null) => void;
  onAddNote: (path: string, line: number) => void;
  onDeleteNote: (id: number) => void;
  onToggleHotspot: (id: string) => void;
  onCheckFlag: ((range: LineRange) => void) | null;
};

type CodeLineProps = {
  path: string;
  hunkIndex: number;
  lineIndex: number;
  line: DiffLine;
  tokens: Token[];
  linked: boolean;
  hotspots: DisplayHotspot[];
  checkedHotspots: string[];
  notes: Note[];
  elementId: string | undefined;
  landed: LineTarget | null;
  handlers: LineHandlers;
};

const ROW_STYLES = {
  add: "bg-add",
  del: "bg-del",
  context: "group-hover:bg-muted/60",
};
const LANDED_LINE =
  "relative before:absolute before:inset-y-0 before:left-0 before:w-0.5 before:bg-primary after:pointer-events-none after:absolute after:inset-0 after:bg-primary/15";
const MARKER_STYLES = {
  add: "text-add-foreground",
  del: "text-del-foreground",
  context: "text-muted-foreground",
};
const MARKERS = { add: "+", del: "−", context: " " };

const LINE_NUMBER_WIDTH = "w-8 shrink-0 sm:w-12";
const NOTE_BUTTON_WIDTH = "w-6 shrink-0";
const MARKER_WIDTH = "w-4 shrink-0";

function LineNotes({ notes, onDelete }: { notes: Note[]; onDelete: (id: number) => void }) {
  return (
    <div className="flex flex-col gap-2 border-y bg-card px-4 py-2 font-sans text-sm sm:px-12">
      {notes.map((note) => (
        <div key={note.id} className="group/note flex items-start gap-2">
          <NoteKindBadge kind={note.kind} />
          <span className="flex-1 whitespace-pre-wrap">{note.body}</span>
          <Button
            variant="ghost"
            size="icon-xs"
            aria-label="Delete note"
            onClick={() => onDelete(note.id)}
            className="opacity-0 group-hover/note:opacity-100 focus-visible:opacity-100 pointer-coarse:opacity-100"
          >
            <Trash2 />
          </Button>
        </div>
      ))}
    </div>
  );
}

function symbolPosition(path: string, line: DiffLine, target: IdentifierTarget): SymbolPosition {
  const onNewSide = line.newLine !== null;
  return {
    ...target,
    path,
    line: line.newLine ?? line.oldLine ?? 1,
    side: onNewSide ? "new" : "old",
  };
}

function LineNumber({ value }: { value: number | null }) {
  return (
    <span className={cn(LINE_NUMBER_WIDTH, "pr-2 text-right text-muted-foreground/70 select-none")}>
      {value ?? ""}
    </span>
  );
}

function NoteButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      title="Add a note on this line (c)"
      className="text-primary opacity-0 transition-[opacity,transform] duration-150 ease-spring group-hover:opacity-100 hover:scale-125 focus-visible:opacity-100 pointer-coarse:opacity-100"
    >
      <MessageSquarePlus size={14} />
    </button>
  );
}

function GutterSpacer() {
  return (
    <>
      <span className={LINE_NUMBER_WIDTH} />
      <span className={LINE_NUMBER_WIDTH} />
      <span className={NOTE_BUTTON_WIDTH} />
      <span className={MARKER_WIDTH} />
    </>
  );
}

function LineFlagRow({
  kind,
  range,
  hotspots,
  checked,
  onAddNote,
  handlers,
}: {
  kind: DiffLine["kind"];
  range: LineRange;
  hotspots: DisplayHotspot[];
  checked: string[];
  onAddNote: (() => void) | null;
  handlers: LineHandlers;
}) {
  const { onCheckFlag } = handlers;
  return (
    <div className={cn("transition-colors duration-150", ROW_STYLES[kind])}>
      <div className={cn("flex py-1", flagLineTint(hotspots, checked))}>
        <GutterSpacer />
        <div className="min-w-0 flex-1 pr-4 max-sm:pr-2">
          <HotspotFlag
            hotspots={hotspots}
            checked={checked}
            onToggleChecked={handlers.onToggleHotspot}
            onAddNote={onAddNote}
            onCheck={onCheckFlag ? () => onCheckFlag(range) : null}
          />
        </div>
      </div>
    </div>
  );
}

export function CodeLine({
  path,
  hunkIndex,
  lineIndex,
  line,
  tokens,
  linked,
  hotspots,
  checkedHotspots,
  notes,
  elementId,
  landed,
  handlers,
}: CodeLineProps) {
  const lineNumber = line.newLine;
  const addNote = lineNumber === null ? null : () => handlers.onAddNote(path, lineNumber);
  const positionOf = (target: IdentifierTarget) => symbolPosition(path, line, target);
  const here = { hunk: hunkIndex, line: lineIndex };
  return (
    <>
      <div className="group">
        <div
          id={elementId}
          data-path={path}
          data-hunk={hunkIndex}
          data-line={lineIndex}
          aria-current={landed ? "location" : undefined}
          className={cn(
            "flex scroll-mt-32 transition-colors duration-150",
            ROW_STYLES[line.kind],
            landed && LANDED_LINE,
          )}
        >
          <LineNumber value={line.oldLine} />
          <LineNumber value={lineNumber} />
          <span className={cn(NOTE_BUTTON_WIDTH, "flex justify-center select-none")}>
            {addNote && <NoteButton onClick={addNote} />}
          </span>
          <span className={cn(MARKER_WIDTH, "select-none", MARKER_STYLES[line.kind])}>
            {MARKERS[line.kind]}
          </span>
          <code className="flex-1 pr-4 break-words whitespace-pre-wrap max-sm:tab-2 max-sm:pr-2">
            <CodeTokens
              tokens={tokens}
              onIdentifier={
                linked ? (target) => handlers.onIdentifier(positionOf(target)) : undefined
              }
              onHover={(target) => handlers.onHoverIdentifier(target && positionOf(target))}
              emphasis={landed?.name}
            />
          </code>
        </div>
        {hotspots.length > 0 && (
          <LineFlagRow
            kind={line.kind}
            range={{ path, from: here, to: here }}
            hotspots={hotspots}
            checked={checkedHotspots}
            onAddNote={addNote}
            handlers={handlers}
          />
        )}
      </div>
      {notes.length > 0 && <LineNotes notes={notes} onDelete={handlers.onDeleteNote} />}
    </>
  );
}
