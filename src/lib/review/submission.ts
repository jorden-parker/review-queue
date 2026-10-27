import type { ReviewEvent, ReviewSubmission } from "@/lib/github/gh";
import type { Note, NoteKind } from "@/lib/types";
import { conventionalLabel } from "./conventional-comment";

type PostableNote = Note & { kind: Exclude<NoteKind, "parked"> };

function isPostable(note: Note): note is PostableNote {
  return note.kind !== "parked";
}

function labelled(note: PostableNote): string {
  return `**${conventionalLabel(note)}:** ${note.body}`;
}

function isLineComment<T extends Note>(note: T): note is T & { path: string; line: number } {
  return note.path !== null && note.line !== null;
}

export function buildSubmission(
  notes: Note[],
  event: ReviewEvent,
  summary: string,
  headSha: string,
): ReviewSubmission {
  const postable = notes.filter(isPostable);
  const general = postable
    .filter((note) => !isLineComment(note))
    .map((note) => `- ${labelled(note)}`);
  const body = [summary.trim(), general.join("\n")].filter(Boolean).join("\n\n");
  return {
    event,
    body,
    commitId: headSha,
    comments: postable
      .filter(isLineComment)
      .map((note) => ({ path: note.path, line: note.line, body: labelled(note) })),
  };
}
