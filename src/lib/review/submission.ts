import type { ReviewEvent, ReviewSubmission } from "@/lib/github/gh";
import type { Note, NoteKind } from "@/lib/types";

const LABELS: Record<NoteKind, string> = {
  blocker: "**Blocker:**",
  question: "**Question:**",
  nit: "**Nit:**",
  praise: "**Nice:**",
  parked: "**Aside:**",
};

function labelled(note: Note): string {
  return `${LABELS[note.kind]} ${note.body}`;
}

function isLineComment(note: Note): note is Note & { path: string; line: number } {
  return note.path !== null && note.line !== null;
}

export function buildSubmission(
  notes: Note[],
  event: ReviewEvent,
  summary: string,
  headSha: string,
): ReviewSubmission {
  const general = notes.filter((note) => !isLineComment(note)).map((note) => `- ${labelled(note)}`);
  const body = [summary.trim(), general.join("\n")].filter(Boolean).join("\n\n");
  return {
    event,
    body,
    commitId: headSha,
    comments: notes
      .filter(isLineComment)
      .map((note) => ({ path: note.path, line: note.line, body: labelled(note) })),
  };
}
