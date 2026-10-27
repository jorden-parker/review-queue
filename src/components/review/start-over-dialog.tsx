"use client";

import { useState } from "react";
import { AppDialog } from "@/components/common/app-dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";

type StartOverDialogProps = {
  noteCount: number;
  onStartOver: (keepNotes: boolean) => void;
  onCancel: () => void;
};

function plural(count: number, word: string): string {
  return `${count} ${word}${count === 1 ? "" : "s"}`;
}

function DeleteNotesOption({
  noteCount,
  checked,
  onChange,
}: {
  noteCount: number;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-lg p-2 text-sm transition-colors duration-calm hover:bg-muted">
      <Checkbox
        checked={checked}
        onCheckedChange={(value) => onChange(value === true)}
        className="mt-0.5"
      />
      <span className="flex flex-col gap-0.5">
        Also delete my {plural(noteCount, "note")}
        <span className="text-xs text-muted-foreground">
          Notes you haven&apos;t posted are gone for good.
        </span>
      </span>
    </label>
  );
}

export function StartOverDialog({ noteCount, onStartOver, onCancel }: StartOverDialogProps) {
  const [deleteNotes, setDeleteNotes] = useState(false);
  return (
    <AppDialog title="Start this review over?" onClose={onCancel}>
      <p className="text-sm text-muted-foreground">
        Done steps, checked hotspots, your pause note and the jump trail are cleared. The local
        model&apos;s answers stay cached.
      </p>
      {noteCount > 0 && (
        <DeleteNotesOption noteCount={noteCount} checked={deleteNotes} onChange={setDeleteNotes} />
      )}
      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={onCancel}>
          Keep my progress
        </Button>
        <Button variant="destructive" onClick={() => onStartOver(!deleteNotes)}>
          Start over
        </Button>
      </div>
    </AppDialog>
  );
}
