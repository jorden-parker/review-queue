"use client";

import { useState } from "react";
import type { NoteKind } from "@/lib/types";
import { LINE_NOTE_KINDS, NOTE_KIND_LABELS, NOTE_KIND_STYLES } from "./note-kinds";

type NoteComposerProps = {
  onSave: (kind: NoteKind, body: string) => void;
  onCancel: () => void;
};

export function NoteComposer({ onSave, onCancel }: NoteComposerProps) {
  const [kind, setKind] = useState<NoteKind>("question");
  const [body, setBody] = useState("");

  function save() {
    if (body.trim()) onSave(kind, body.trim());
  }

  function handleKey(event: React.KeyboardEvent) {
    event.stopPropagation();
    if (event.key === "Escape") onCancel();
    if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) save();
  }

  return (
    <div className="flex flex-col gap-2 border-y border-line bg-panel p-3 font-sans">
      <div className="flex gap-1">
        {LINE_NOTE_KINDS.map((option) => (
          <button
            key={option}
            onClick={() => setKind(option)}
            className={`rounded-full px-3 py-0.5 text-sm ${option === kind ? NOTE_KIND_STYLES[option] + " font-bold" : "text-muted"}`}
          >
            {NOTE_KIND_LABELS[option]}
          </button>
        ))}
      </div>
      <textarea
        autoFocus
        value={body}
        onChange={(event) => setBody(event.target.value)}
        onKeyDown={handleKey}
        rows={3}
        placeholder="What did you notice? (⌘↵ to save, Esc to cancel)"
        className="rounded-lg border border-line bg-bg p-2 text-sm outline-none focus:border-accent"
      />
      <div className="flex justify-end gap-2 text-sm">
        <button onClick={onCancel} className="px-3 py-1 text-muted">
          Cancel
        </button>
        <button onClick={save} className="rounded-lg bg-accent px-3 py-1 font-bold text-panel">
          Save note
        </button>
      </div>
    </div>
  );
}
