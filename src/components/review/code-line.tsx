"use client";

import { MessageSquarePlus, Trash2 } from "lucide-react";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import type { LineRange } from "@/lib/assist-protocol";
import type { Token } from "@/lib/highlight";
import type { DiffLine, Note, SymbolPosition } from "@/lib/types";
import { CodeTokens, type IdentifierTarget } from "./code-tokens";
import { HotspotFlag } from "./hotspot-flag";
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
  context: "hover:bg-muted/60",
};
const MARKER_STYLES = {
  add: "text-add-foreground",
  del: "text-del-foreground",
  context: "text-muted-foreground",
};
const MARKERS = { add: "+", del: "−", context: " " };

function LineNotes({ notes, onDelete }: { notes: Note[]; onDelete: (id: number) => void }) {
  return (
    <div className="flex flex-col gap-2 border-y bg-card px-12 py-2 font-sans text-sm">
      {notes.map((note) => (
        <div key={note.id} className="group/note flex items-start gap-2">
          <NoteKindBadge kind={note.kind} />
          <span className="flex-1 whitespace-pre-wrap">{note.body}</span>
          <Button
            variant="ghost"
            size="icon-xs"
            aria-label="Delete note"
            onClick={() => onDelete(note.id)}
            className="opacity-0 group-hover/note:opacity-100 focus-visible:opacity-100"
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
    <span className="w-12 shrink-0 pr-2 text-right text-muted-foreground/70 select-none">
      {value ?? ""}
    </span>
  );
}

function NoteButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      title="Add a note on this line (c)"
      className="text-primary opacity-0 transition-[opacity,transform] duration-150 ease-spring group-hover:opacity-100 hover:scale-125 focus-visible:opacity-100"
    >
      <MessageSquarePlus size={14} />
    </button>
  );
}

function LineFlags({
  range,
  hotspots,
  checked,
  onAddNote,
  handlers,
}: {
  range: LineRange;
  hotspots: DisplayHotspot[];
  checked: string[];
  onAddNote: (() => void) | null;
  handlers: LineHandlers;
}) {
  const { onCheckFlag } = handlers;
  return (
    <span className="shrink-0 self-start px-2">
      <HotspotFlag
        hotspots={hotspots}
        checked={checked}
        onToggleChecked={handlers.onToggleHotspot}
        onAddNote={onAddNote}
        onCheck={onCheckFlag ? () => onCheckFlag(range) : null}
      />
    </span>
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
      <div
        id={elementId}
        data-path={path}
        data-hunk={hunkIndex}
        data-line={lineIndex}
        aria-current={landed ? "location" : undefined}
        className={cn(
          "group flex scroll-mt-32 transition-colors duration-150",
          ROW_STYLES[line.kind],
          landed && "ring-2 ring-primary ring-inset",
        )}
      >
        <LineNumber value={line.oldLine} />
        <LineNumber value={lineNumber} />
        <span className="flex w-6 shrink-0 justify-center select-none">
          {addNote && <NoteButton onClick={addNote} />}
        </span>
        <span className={cn("w-4 shrink-0 select-none", MARKER_STYLES[line.kind])}>
          {MARKERS[line.kind]}
        </span>
        <code className="flex-1 pr-4 break-words whitespace-pre-wrap">
          <CodeTokens
            tokens={tokens}
            onIdentifier={
              linked ? (target) => handlers.onIdentifier(positionOf(target)) : undefined
            }
            onHover={(target) => handlers.onHoverIdentifier(target && positionOf(target))}
            emphasis={landed?.name}
          />
        </code>
        {hotspots.length > 0 && (
          <LineFlags
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
