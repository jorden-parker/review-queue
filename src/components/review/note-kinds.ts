import type { NoteKind } from "@/lib/types";

export const NOTE_KIND_LABELS: Record<NoteKind, string> = {
  praise: "Praise",
  nitpick: "Nitpick",
  suggestion: "Suggestion",
  issue: "Issue",
  todo: "Todo",
  question: "Question",
  thought: "Thought",
  chore: "Chore",
  note: "Note",
  typo: "Typo",
  polish: "Polish",
  quibble: "Quibble",
  parked: "Parked",
};

export const NOTE_KIND_HINTS: Record<NoteKind, string> = {
  praise: "Something positive. Be sincere.",
  nitpick: "A trivial, preference-based request.",
  suggestion: "A proposed improvement. Say what and why.",
  issue: "A specific problem. Pair it with a suggestion.",
  todo: "A small, necessary change.",
  question: "A possible concern you are unsure about.",
  thought: "An idea that came up while reading.",
  chore: "A process task to do before this is accepted.",
  note: "Something the reader should know.",
  typo: "A misspelling.",
  polish: "Nothing is wrong, but quality could improve.",
  quibble: "Like a nitpick.",
  parked: "A private aside. It is never posted.",
};

export const NOTE_KIND_STYLES: Record<NoteKind, string> = {
  praise: "bg-add text-add-foreground",
  nitpick: "bg-muted text-muted-foreground",
  suggestion: "bg-accent text-accent-foreground",
  issue: "bg-del text-del-foreground",
  todo: "bg-callout text-callout-foreground",
  question: "bg-accent text-accent-foreground",
  thought: "bg-muted text-muted-foreground",
  chore: "bg-callout text-callout-foreground",
  note: "bg-muted text-muted-foreground",
  typo: "bg-callout text-callout-foreground",
  polish: "bg-accent text-accent-foreground",
  quibble: "bg-muted text-muted-foreground",
  parked: "bg-callout text-callout-foreground",
};
