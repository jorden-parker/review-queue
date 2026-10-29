import type { DiffLine, DiffSide, FileDiff, Note } from "@/lib/types";

type LineNote = Note & { path: string; line: number };

function isLineNote(note: Note): note is LineNote {
  return note.path !== null && note.line !== null;
}

function numberOn(line: DiffLine, side: DiffSide): number | null {
  return side === "old" ? line.oldLine : line.newLine;
}

function hunkOf(file: FileDiff, side: DiffSide, lineNumber: number): number | null {
  const index = file.hunks.findIndex((hunk) =>
    hunk.lines.some((line) => numberOn(line, side) === lineNumber),
  );
  return index === -1 ? null : index;
}

function isOnDiff(note: LineNote, files: readonly FileDiff[]): boolean {
  const file = files.find((candidate) => candidate.path === note.path);
  if (!file) return false;
  const hunk = hunkOf(file, note.side, note.line);
  if (hunk === null) return false;
  return note.startLine === null || hunkOf(file, note.side, note.startLine) === hunk;
}

export function notesOffTheDiff(notes: readonly Note[], files: readonly FileDiff[]): Note[] {
  return notes.filter(isLineNote).filter((note) => !isOnDiff(note, files));
}

export function offTheDiffMessage(notes: readonly Note[]): string {
  const places = notes.map((note) => `${note.path}:${note.line}`).join(", ");
  return `${notes.length === 1 ? "This note points" : "These notes point"} at a line the diff no longer has: ${places}. Deselect or delete ${notes.length === 1 ? "it" : "them"} before posting.`;
}
