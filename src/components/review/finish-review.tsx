"use client";

import { useState } from "react";
import { cn } from "cn";
import { AppDialog } from "@/components/common/app-dialog";
import { EmptyState } from "@/components/common/empty-state";
import { PathLabel } from "@/components/common/path-label";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import type { ReviewEvent } from "@/lib/github/gh";
import type { Note } from "@/lib/types";
import { NoteKindBadge } from "./note-kind-badge";
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
    <AppDialog title="Finish review" onClose={onCancel} className="sm:max-w-2xl">
      {unfinished && (
        <p className="rounded-lg bg-callout px-3 py-2 text-sm text-callout-foreground">
          {unfinished}
        </p>
      )}
      <div className="flex flex-col gap-2">
        <h3 className="text-sm font-medium">Notes to post ({selected.length})</h3>
        {notes.length === 0 && <EmptyState emoji="📝">No notes.</EmptyState>}
        {notes.map((note) => (
          <label
            key={note.id}
            className="flex cursor-pointer items-start gap-3 rounded-lg p-2 text-sm transition-colors duration-150 hover:bg-muted"
          >
            <Checkbox
              checked={selected.includes(note.id)}
              onCheckedChange={() => toggle(note.id)}
              className="mt-0.5"
            />
            <NoteKindBadge kind={note.kind} />
            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
              {note.body}
              {note.path && <PathLabel path={note.path} line={note.line} />}
            </span>
          </label>
        ))}
      </div>
      <Textarea
        value={summary}
        onChange={(changeEvent) => setSummary(changeEvent.target.value)}
        rows={3}
        placeholder="Overall summary (optional)"
      />
      <div className="flex gap-2">
        {EVENTS.map((option) => (
          <Button
            key={option.value}
            variant={event === option.value ? "secondary" : "outline"}
            onClick={() => setEvent(option.value)}
            className={cn(event === option.value && "bg-accent text-accent-foreground")}
          >
            {option.label}
          </Button>
        ))}
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={onCancel}>
          Not yet
        </Button>
        <Button onClick={send} disabled={sending}>
          {sending ? "Posting…" : "Post review to GitHub"}
        </Button>
      </div>
    </AppDialog>
  );
}
