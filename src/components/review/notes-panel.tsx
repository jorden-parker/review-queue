"use client";

import { Trash2 } from "lucide-react";
import { useState } from "react";
import { EmptyState } from "@/components/common/empty-state";
import { PathLabel } from "@/components/common/path-label";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Note } from "@/lib/types";
import { NoteKindBadge } from "./note-kind-badge";

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
    <div className="flex flex-col gap-5">
      <form onSubmit={park} className="flex flex-col gap-2">
        <label htmlFor="parking" className="text-sm font-bold">
          Parking lot
        </label>
        <Input
          id="parking"
          ref={parkingRef}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => event.stopPropagation()}
          placeholder="Off-topic thought? Park it here (P)"
        />
      </form>
      {parked.length > 0 && (
        <ul className="flex flex-col gap-0.5">
          {parked.map((note) => (
            <NoteRow key={note.id} note={note} onOpen={onOpen} onDelete={onDelete} />
          ))}
        </ul>
      )}
      <div className="flex flex-col gap-2">
        <h3 className="text-sm font-bold">Notes on code ({lineNotes.length})</h3>
        {lineNotes.length === 0 ? (
          <EmptyState emoji="💬">Hover a line and click the speech bubble, or press c.</EmptyState>
        ) : (
          <ul className="flex flex-col gap-0.5">
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
    <li className="group flex items-start gap-2 rounded-lg p-2 transition-colors duration-calm hover:bg-muted">
      <NoteKindBadge kind={note.kind} />
      <button
        onClick={() => onOpen(note)}
        className="flex min-w-0 flex-1 flex-col gap-0.5 text-left text-sm"
      >
        <span className="whitespace-pre-wrap wrap-anywhere">{note.body}</span>
        {note.path && <PathLabel path={note.path} line={note.line} wrap />}
      </button>
      <Button
        variant="ghost"
        size="icon-xs"
        aria-label="Delete note"
        onClick={() => onDelete(note.id)}
        className="opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
      >
        <Trash2 />
      </Button>
    </li>
  );
}
