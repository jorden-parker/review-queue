"use client";

import { useState } from "react";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { MarkdownField } from "@/components/common/markdown-field";
import { exclusiveDecorations } from "@/lib/review/conventional-comment";
import { NOTE_DECORATIONS, NOTE_LABELS, type NoteDecoration, type NoteTag } from "@/lib/types";
import { NOTE_KIND_HINTS, NOTE_KIND_LABELS, NOTE_KIND_STYLES } from "./note-kinds";

type NoteComposerProps = {
  onSave: (tag: NoteTag, body: string) => void;
  onCancel: () => void;
};

export function NoteTagPicker({
  tag,
  onChange,
}: {
  tag: NoteTag;
  onChange: (tag: NoteTag) => void;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex flex-wrap items-center gap-1">
        {NOTE_LABELS.map((option) => (
          <Button
            key={option}
            variant="ghost"
            size="xs"
            onClick={() => onChange({ ...tag, kind: option })}
            className={cn("rounded-full", option === tag.kind && NOTE_KIND_STYLES[option])}
          >
            {NOTE_KIND_LABELS[option]}
          </Button>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">{NOTE_KIND_HINTS[tag.kind]}</p>
      <ToggleGroup
        type="multiple"
        size="sm"
        value={tag.decorations}
        onValueChange={(next) =>
          onChange({
            ...tag,
            decorations: exclusiveDecorations(tag.decorations, next as NoteDecoration[]),
          })
        }
        className="flex-wrap"
      >
        {NOTE_DECORATIONS.map((decoration) => (
          <ToggleGroupItem key={decoration} value={decoration} className="text-xs">
            {decoration}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
    </div>
  );
}

export function NoteComposer({ onSave, onCancel }: NoteComposerProps) {
  const [tag, setTag] = useState<NoteTag>({ kind: "question", decorations: [] });
  const [body, setBody] = useState("");

  function save() {
    if (body.trim()) onSave(tag, body.trim());
  }

  function handleKey(event: React.KeyboardEvent) {
    event.stopPropagation();
    if (event.key === "Escape") onCancel();
    if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) save();
  }

  return (
    <div className="flex animate-step-enter flex-col gap-2 border-y bg-card p-3 font-sans">
      <NoteTagPicker tag={tag} onChange={setTag} />
      <MarkdownField
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
