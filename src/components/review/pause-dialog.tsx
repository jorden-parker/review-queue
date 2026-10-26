"use client";

import { useState } from "react";
import { AppDialog } from "@/components/common/app-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type PauseDialogProps = { onPause: (note: string) => void; onCancel: () => void };

export function PauseDialog({ onPause, onCancel }: PauseDialogProps) {
  const [note, setNote] = useState("");

  function submit(event: React.FormEvent) {
    event.preventDefault();
    onPause(note.trim());
  }

  return (
    <AppDialog title="☕ Pausing. What were you about to do?" onClose={onCancel}>
      <form onSubmit={submit} className="flex flex-col gap-4">
        <p className="text-sm text-muted-foreground">
          One line for future you. It shows up when you come back.
        </p>
        <Input
          autoFocus
          aria-label="Note for future you"
          value={note}
          onChange={(event) => setNote(event.target.value)}
          placeholder="e.g. check the retry loop handles timeouts"
        />
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onCancel}>
            Keep going
          </Button>
          <Button type="submit">Pause</Button>
        </div>
      </form>
    </AppDialog>
  );
}
