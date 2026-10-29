import type { FileDiff, Note } from "@/lib/types";

type LineNote = Note & { path: string; line: number };

function isLineNote(note: Note): note is LineNote {
  return note.path !== null && note.line !== null;
}

function newSideLines(files: readonly FileDiff[]): Map<string, Set<number>> {
  const lines = new Map<string, Set<number>>();
  for (const file of files) {
    const numbers = new Set<number>();
    for (const hunk of file.hunks) {
      for (const line of hunk.lines) if (line.newLine !== null) numbers.add(line.newLine);
    }
    lines.set(file.path, numbers);
  }
  return lines;
}

export function notesOffTheDiff(notes: readonly Note[], files: readonly FileDiff[]): Note[] {
  const lines = newSideLines(files);
  return notes.filter(isLineNote).filter((note) => !lines.get(note.path)?.has(note.line));
}

export function offTheDiffMessage(notes: readonly Note[]): string {
  const places = notes.map((note) => `${note.path}:${note.line}`).join(", ");
  return `${notes.length === 1 ? "This note points" : "These notes point"} at a line the diff no longer has: ${places}. Deselect or delete ${notes.length === 1 ? "it" : "them"} before posting.`;
}
