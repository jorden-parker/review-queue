"use client";

import { Flag, MessageSquarePlus } from "lucide-react";
import type { Token } from "@/lib/highlight";
import type { DiffLine, Hotspot, Note } from "@/lib/types";
import { NOTE_KIND_LABELS, NOTE_KIND_STYLES } from "./note-kinds";

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

const IDENTIFIER_SPLIT = /([A-Za-z_$][\w$]*)/;
const ROW_STYLES = { add: "bg-add", del: "bg-del", context: "" };
const MARKERS = { add: "+", del: "−", context: " " };

function TokenText({
  token,
  linkable,
  onIdentifier,
  onHover,
}: {
  token: Token;
  linkable: Set<string>;
  onIdentifier: (name: string) => void;
  onHover: (name: string | null) => void;
}) {
  const style = { "--light": token.light, "--dark": token.dark } as React.CSSProperties;
  const parts = token.text.split(IDENTIFIER_SPLIT);
  return (
    <span className="code-token" style={style}>
      {parts.map((part, index) =>
        linkable.has(part) ? (
          <button
            key={index}
            onClick={() => onIdentifier(part)}
            onMouseEnter={() => onHover(part)}
            onMouseLeave={() => onHover(null)}
            className="cursor-pointer underline decoration-dotted decoration-1 underline-offset-4 hover:bg-accent-soft"
          >
            {part}
          </button>
        ) : (
          part
        ),
      )}
    </span>
  );
}

function LineNotes({ notes, onDelete }: { notes: Note[]; onDelete: (id: number) => void }) {
  return (
    <div className="flex flex-col gap-1 border-y border-line bg-panel px-12 py-2 font-sans text-sm">
      {notes.map((note) => (
        <div key={note.id} className="flex items-start gap-2">
          <span className={`rounded-full px-2 text-xs font-bold ${NOTE_KIND_STYLES[note.kind]}`}>
            {NOTE_KIND_LABELS[note.kind]}
          </span>
          <span className="flex-1 whitespace-pre-wrap">{note.body}</span>
          <button onClick={() => onDelete(note.id)} className="text-xs text-muted hover:text-high">
            delete
          </button>
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
      <div id={elementId} className={`group flex scroll-mt-32 ${ROW_STYLES[line.kind]}`}>
        <span className="w-12 shrink-0 select-none pr-2 text-right text-muted">
          {line.oldLine ?? ""}
        </span>
        <span className="w-12 shrink-0 select-none pr-2 text-right text-muted">
          {lineNumber ?? ""}
        </span>
        <span className="w-6 shrink-0 select-none text-center text-muted">
          {canNote ? (
            <button
              onClick={() => handlers.onAddNote(path, lineNumber)}
              title="Add a note on this line (c)"
              className="invisible text-accent group-hover:visible"
            >
              <MessageSquarePlus size={14} />
            </button>
          ) : null}
        </span>
        <span className="w-4 shrink-0 select-none text-muted">{MARKERS[line.kind]}</span>
        <code className="flex-1 whitespace-pre-wrap break-words pr-4">
          {tokens.map((token, index) => (
            <TokenText
              key={index}
              token={token}
              linkable={linkable}
              onIdentifier={(name) =>
                handlers.onIdentifier(name, path, lineNumber ?? line.oldLine ?? 1)
              }
              onHover={handlers.onHoverIdentifier}
            />
          ))}
        </code>
        {hotspots.length > 0 && (
          <span
            className="flex shrink-0 items-center gap-1 px-2 font-sans text-xs text-high"
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
