"use client";

import { Flag, MessageSquarePlus, Trash2 } from "lucide-react";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import type { Token } from "@/lib/highlight";
import type { DiffLine, Hotspot, Note } from "@/lib/types";
import { CodeTokens } from "./code-tokens";
import { NoteKindBadge } from "./note-kind-badge";

export type LineHandlers = {
  onIdentifier: (name: string, path: string, line: number) => void;
  onHoverIdentifier: (name: string | null) => void;
  onAddNote: (path: string, line: number) => void;
  onDeleteNote: (id: number) => void;
};

type CodeLineProps = {
  path: string;
  line: DiffLine;
  tokens: Token[];
  linkable: Set<string>;
  hotspots: Hotspot[];
  notes: Note[];
  elementId: string | undefined;
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

export function CodeLine({
  path,
  line,
  tokens,
  linkable,
  hotspots,
  notes,
  elementId,
  handlers,
}: CodeLineProps) {
  const lineNumber = line.newLine;
  const canNote = lineNumber !== null;
  return (
    <>
      <div
        id={elementId}
        className={cn(
          "group flex scroll-mt-32 transition-colors duration-150",
          ROW_STYLES[line.kind],
        )}
      >
        <span className="w-12 shrink-0 pr-2 text-right text-muted-foreground/70 select-none">
          {line.oldLine ?? ""}
        </span>
        <span className="w-12 shrink-0 pr-2 text-right text-muted-foreground/70 select-none">
          {lineNumber ?? ""}
        </span>
        <span className="flex w-6 shrink-0 justify-center select-none">
          {canNote ? (
            <button
              onClick={() => handlers.onAddNote(path, lineNumber)}
              title="Add a note on this line (c)"
              className="text-primary opacity-0 transition-[opacity,transform] duration-150 ease-spring group-hover:opacity-100 hover:scale-125 focus-visible:opacity-100"
            >
              <MessageSquarePlus size={14} />
            </button>
          ) : null}
        </span>
        <span className={cn("w-4 shrink-0 select-none", MARKER_STYLES[line.kind])}>
          {MARKERS[line.kind]}
        </span>
        <code className="flex-1 pr-4 break-words whitespace-pre-wrap">
          <CodeTokens
            tokens={tokens}
            linkable={linkable}
            onIdentifier={(name) =>
              handlers.onIdentifier(name, path, lineNumber ?? line.oldLine ?? 1)
            }
            onHover={handlers.onHoverIdentifier}
          />
        </code>
        {hotspots.length > 0 && (
          <span
            className="flex shrink-0 items-center gap-1 px-2 font-sans text-xs text-severity-high"
            title={hotspots.map((hotspot) => `${hotspot.title}: ${hotspot.why}`).join("\n")}
          >
            <Flag size={12} /> {hotspots[0].title}
          </span>
        )}
      </div>
      {notes.length > 0 && <LineNotes notes={notes} onDelete={handlers.onDeleteNote} />}
    </>
  );
}
