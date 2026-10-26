"use client";

import { useState } from "react";
import type { ReviewEvent } from "@/lib/github/gh";
import type { Note } from "@/lib/types";
import { NOTE_KIND_LABELS, NOTE_KIND_STYLES } from "./note-kinds";
import { unfinishedMessage } from "./unfinished";

type FinishReviewProps = {
  notes: Note[];
  stepsLeft: number;
  hotspotsLeft: number;
  onSubmit: (event: ReviewEvent, summary: string, noteIds: number[]) => Promise<void>;
  onCancel: () => void;
};

const EVENTS: { value: ReviewEvent; label: string }[] = [
  { value: "COMMENT", label: "Comment" },
  { value: "APPROVE", label: "Approve" },
  { value: "REQUEST_CHANGES", label: "Request changes" },
];

export function FinishReview({
  notes,
  stepsLeft,
  hotspotsLeft,
  onSubmit,
  onCancel,
}: FinishReviewProps) {
  const hasBlocker = notes.some((note) => note.kind === "blocker");
  const [event, setEvent] = useState<ReviewEvent>(hasBlocker ? "REQUEST_CHANGES" : "COMMENT");
  const [summary, setSummary] = useState("");
  const [selected, setSelected] = useState(
    notes.filter((note) => note.kind !== "parked").map((note) => note.id),
  );
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggle(id: number) {
    setSelected((current) =>
      current.includes(id) ? current.filter((value) => value !== id) : [...current, id],
    );
  }

  async function send() {
    setSending(true);
    setError(null);
    try {
      await onSubmit(event, summary, selected);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : String(failure));
      setSending(false);
    }
  }

  const unfinished = unfinishedMessage(stepsLeft, hotspotsLeft);

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/30 p-4">
      <section
        onKeyDown={(keyEvent) => keyEvent.stopPropagation()}
        className="flex max-h-[90vh] w-full max-w-2xl flex-col gap-4 overflow-y-auto rounded-2xl border border-line bg-panel p-6 shadow-xl"
      >
        <h2 className="text-xl font-bold">Finish review</h2>
        {unfinished && <p className="rounded-lg bg-focus p-3 text-sm">{unfinished}</p>}
        <div className="flex flex-col gap-1">
          <h3 className="text-sm font-bold">Notes to post ({selected.length})</h3>
          {notes.length === 0 && <p className="text-sm text-muted">No notes.</p>}
          {notes.map((note) => (
            <label
              key={note.id}
              className="flex items-start gap-2 rounded p-1 text-sm hover:bg-sunken"
            >
              <input
                type="checkbox"
                checked={selected.includes(note.id)}
                onChange={() => toggle(note.id)}
                className="mt-1"
              />
              <span
                className={`rounded-full px-2 text-xs font-bold ${NOTE_KIND_STYLES[note.kind]}`}
              >
                {NOTE_KIND_LABELS[note.kind]}
              </span>
              <span className="flex-1">
                {note.body}
                {note.path && (
                  <span className="block font-mono text-xs text-muted">
                    {note.path}:{note.line}
                  </span>
                )}
              </span>
            </label>
          ))}
        </div>
        <textarea
          value={summary}
          onChange={(changeEvent) => setSummary(changeEvent.target.value)}
          rows={3}
          placeholder="Overall summary (optional)"
          className="rounded-lg border border-line bg-bg p-2 text-sm outline-none focus:border-accent"
        />
        <div className="flex gap-2">
          {EVENTS.map((option) => (
            <button
              key={option.value}
              onClick={() => setEvent(option.value)}
              className={`rounded-lg border px-3 py-1 text-sm ${event === option.value ? "border-accent bg-accent-soft font-bold" : "border-line"}`}
            >
              {option.label}
            </button>
          ))}
        </div>
        {error && <p className="text-sm text-high">{error}</p>}
        <div className="flex justify-end gap-2">
          <button onClick={onCancel} className="px-3 py-1 text-muted">
            Not yet
          </button>
          <button
            onClick={send}
            disabled={sending}
            className="rounded-lg bg-accent px-4 py-2 font-bold text-panel disabled:opacity-50"
          >
            {sending ? "Posting…" : "Post review to GitHub"}
          </button>
        </div>
      </section>
    </div>
  );
}
