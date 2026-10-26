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
  blocker: "bg-del text-del-foreground",
  question: "bg-accent text-accent-foreground",
  nit: "bg-muted text-muted-foreground",
  praise: "bg-add text-add-foreground",
  parked: "bg-callout text-callout-foreground",
};
