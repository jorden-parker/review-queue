"use client";

import { useState } from "react";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
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
    <div className="flex animate-step-enter flex-col gap-2 border-y bg-card p-3 font-sans">
      <div className="flex gap-1">
        {LINE_NOTE_KINDS.map((option) => (
          <Button
            key={option}
            variant="ghost"
            size="xs"
            onClick={() => setKind(option)}
            className={cn("rounded-full", option === kind && NOTE_KIND_STYLES[option])}
          >
            {NOTE_KIND_LABELS[option]}
          </Button>
        ))}
      </div>
      <Textarea
        autoFocus
        value={body}
        onChange={(event) => setBody(event.target.value)}
        onKeyDown={handleKey}
        rows={3}
        placeholder="What did you notice? (⌘↵ to save, Esc to cancel)"
      />
      <div className="flex justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={onCancel}>
          Cancel
        </Button>
        <Button size="sm" onClick={save}>
          Save note
        </Button>
      </div>
    </div>
  );
}
