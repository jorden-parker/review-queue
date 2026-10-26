"use client";

import { useState } from "react";
import type { Note } from "@/lib/types";
import { NOTE_KIND_LABELS, NOTE_KIND_STYLES } from "./note-kinds";

type NotesPanelProps = {
  notes: Note[];
  onPark: (body: string) => void;
  onOpen: (note: Note) => void;
  onDelete: (id: number) => void;
  parkingRef: React.Ref<HTMLInputElement>;
};

export function NotesPanel({ notes, onPark, onOpen, onDelete, parkingRef }: NotesPanelProps) {
  const [draft, setDraft] = useState("");
  const parked = notes.filter((note) => note.kind === "parked");
  const lineNotes = notes.filter((note) => note.kind !== "parked");

  function park(event: React.FormEvent) {
    event.preventDefault();
    if (!draft.trim()) return;
    onPark(draft.trim());
    setDraft("");
  }

  return (
    <div className="flex flex-col gap-4">
      <form onSubmit={park} className="flex flex-col gap-1">
        <label htmlFor="parking" className="text-sm font-bold">
          Parking lot
        </label>
        <input
          id="parking"
          ref={parkingRef}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => event.stopPropagation()}
          placeholder="Off-topic thought? Park it here (P)"
          className="rounded-lg border border-line bg-bg px-2 py-1 text-sm outline-none focus:border-accent"
        />
      </form>
      {parked.length > 0 && (
        <ul className="flex flex-col gap-1">
          {parked.map((note) => (
            <NoteRow key={note.id} note={note} onOpen={onOpen} onDelete={onDelete} />
          ))}
        </ul>
      )}
      <div className="flex flex-col gap-1">
        <h3 className="text-sm font-bold">Notes on code ({lineNotes.length})</h3>
        {lineNotes.length === 0 ? (
          <p className="text-sm text-muted">
            Hover a line and click the speech bubble, or press c.
          </p>
        ) : (
          <ul className="flex flex-col gap-1">
            {lineNotes.map((note) => (
              <NoteRow key={note.id} note={note} onOpen={onOpen} onDelete={onDelete} />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function NoteRow({
  note,
  onOpen,
  onDelete,
}: {
  note: Note;
  onOpen: (note: Note) => void;
  onDelete: (id: number) => void;
}) {
  return (
    <li className="group flex items-start gap-2 rounded-lg p-1 hover:bg-sunken">
      <span
        className={`shrink-0 rounded-full px-2 text-xs font-bold ${NOTE_KIND_STYLES[note.kind]}`}
      >
        {NOTE_KIND_LABELS[note.kind]}
      </span>
      <button onClick={() => onOpen(note)} className="flex flex-1 flex-col text-left text-sm">
        <span className="whitespace-pre-wrap">{note.body}</span>
        {note.path && (
          <span className="font-mono text-xs text-muted">
            {note.path}:{note.line}
          </span>
        )}
      </button>
      <button
        onClick={() => onDelete(note.id)}
        className="invisible text-xs text-muted group-hover:visible"
      >
        delete
      </button>
    </li>
  );
}
