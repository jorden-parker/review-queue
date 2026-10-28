import type { ReviewEvent, ReviewSubmission } from "@/lib/github/gh";
import type { Note, NoteKind } from "@/lib/types";
import { conventionalLabel, splitConventionalPrefix } from "./conventional-comment";

type PostableNote = Note & { kind: Exclude<NoteKind, "parked"> };

const BLOCK_START = /^(?:```|~~~|[-*] |\d+\. |> |#|\|)/;

export function isPostable(note: Note): note is PostableNote {
  return note.kind !== "parked";
}

export function postedBody(note: PostableNote): string {
  const { tag, body } = splitConventionalPrefix(note.body);
  const text = (tag?.kind === note.kind ? body : note.body).trim();
  const label = `**${conventionalLabel(note)}:**`;
  return BLOCK_START.test(text) ? `${label}\n\n${text}` : `${label} ${text}`;
}

function asListItem(text: string): string {
  const [first = "", ...rest] = text.split("\n");
  return [`- ${first}`, ...rest.map(indentLine)].join("\n");
}

function indentLine(line: string): string {
  return line === "" ? "" : `  ${line}`;
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
    .map((note) => asListItem(postedBody(note)));
  const body = [summary.trim(), general.join("\n")].filter(Boolean).join("\n\n");
  return {
    event,
    body,
    commitId: headSha,
    comments: postable
      .filter(isLineComment)
      .map((note) => ({ path: note.path, line: note.line, body: postedBody(note) })),
  };
}
