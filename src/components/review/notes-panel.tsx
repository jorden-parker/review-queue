"use client";

import { Pencil, Trash2 } from "lucide-react";
import { useState } from "react";
import { EmptyState } from "@/components/common/empty-state";
import { PaneRow } from "@/components/common/pane-row";
import { PathLabel } from "@/components/common/path-label";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { Note, NoteKind } from "@/lib/types";
import { NoteKindBadge } from "./note-kind-badge";
import { NoteKindPicker } from "./note-composer";

type NotesPanelProps = {
  notes: Note[];
  onPark: (body: string) => void;
  onOpen: (note: Note) => void;
  onEdit: (id: number, kind: NoteKind, body: string) => void;
  onDelete: (id: number) => void;
  parkingRef: React.Ref<HTMLInputElement>;
};

export function NotesPanel({
  notes,
  onPark,
  onOpen,
  onEdit,
  onDelete,
  parkingRef,
}: NotesPanelProps) {
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
            <NoteRow
              key={note.id}
              note={note}
              onOpen={onOpen}
              onEdit={onEdit}
              onDelete={onDelete}
            />
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
              <NoteRow
                key={note.id}
                note={note}
                onOpen={onOpen}
                onEdit={onEdit}
                onDelete={onDelete}
              />
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
  onEdit,
  onDelete,
}: {
  note: Note;
  onOpen: (note: Note) => void;
  onEdit: (id: number, kind: NoteKind, body: string) => void;
  onDelete: (id: number) => void;
}) {
  const [editing, setEditing] = useState(false);

  if (editing) {
    return (
      <PaneRow>
        <NoteEditor
          note={note}
          onSave={(kind, body) => {
            onEdit(note.id, kind, body);
            setEditing(false);
          }}
          onCancel={() => setEditing(false)}
        />
      </PaneRow>
    );
  }

  return (
    <PaneRow className="group">
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
        aria-label="Edit note"
        onClick={() => setEditing(true)}
        className="opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
      >
        <Pencil />
      </Button>
      <Button
        variant="ghost"
        size="icon-xs"
        aria-label="Delete note"
        onClick={() => onDelete(note.id)}
        className="opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
      >
        <Trash2 />
      </Button>
    </PaneRow>
  );
}

function NoteEditor({
  note,
  onSave,
  onCancel,
}: {
  note: Note;
  onSave: (kind: NoteKind, body: string) => void;
  onCancel: () => void;
}) {
  const [kind, setKind] = useState<NoteKind>(note.kind);
  const [body, setBody] = useState(note.body);

  function save() {
    if (body.trim()) onSave(kind, body.trim());
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Escape") onCancel();
    if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) save();
  }

  return (
    <div className="flex min-w-0 flex-1 flex-col gap-2">
      {note.kind !== "parked" && <NoteKindPicker kind={kind} onChange={setKind} />}
      <Textarea
        value={body}
        onChange={(event) => setBody(event.target.value)}
        onKeyDown={handleKeyDown}
        rows={2}
        autoFocus
      />
      <div className="flex justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={onCancel}>
          Cancel
        </Button>
        <Button size="sm" onClick={save}>
          Save
        </Button>
      </div>
    </div>
  );
}
