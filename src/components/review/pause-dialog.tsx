"use client";

import { useState } from "react";

type PauseDialogProps = { onPause: (note: string) => void; onCancel: () => void };

export function PauseDialog({ onPause, onCancel }: PauseDialogProps) {
  const [note, setNote] = useState("");

  function submit(event: React.FormEvent) {
    event.preventDefault();
    onPause(note.trim());
  }

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/30 p-4">
      <form
        onSubmit={submit}
        onKeyDown={(event) => {
          event.stopPropagation();
          if (event.key === "Escape") onCancel();
        }}
        className="flex w-full max-w-md flex-col gap-3 rounded-2xl border border-line bg-panel p-6 shadow-xl"
      >
        <h2 className="text-lg font-bold">Pausing. What were you about to do?</h2>
        <p className="text-sm text-muted">
          One line for future you. It shows up when you come back.
        </p>
        <input
          autoFocus
          value={note}
          onChange={(event) => setNote(event.target.value)}
          placeholder="e.g. check the retry loop handles timeouts"
          className="rounded-lg border border-line bg-bg px-3 py-2 outline-none focus:border-accent"
        />
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onCancel} className="px-3 py-1 text-muted">
            Keep going
          </button>
          <button className="rounded-lg bg-accent px-4 py-1 font-bold text-panel">Pause</button>
        </div>
      </form>
    </div>
  );
}
