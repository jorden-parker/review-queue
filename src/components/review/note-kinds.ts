import type { NoteKind } from "@/lib/types";

export const LINE_NOTE_KINDS: NoteKind[] = ["question", "nit", "blocker", "praise"];

export const NOTE_KIND_LABELS: Record<NoteKind, string> = {
  blocker: "Blocker",
  question: "Question",
  nit: "Nit",
  praise: "Praise",
  parked: "Parked",
};

export const NOTE_KIND_STYLES: Record<NoteKind, string> = {
  blocker: "bg-del text-del-ink",
  question: "bg-accent-soft text-accent",
  nit: "bg-sunken text-muted",
  praise: "bg-add text-add-ink",
  parked: "bg-focus text-ink",
};
