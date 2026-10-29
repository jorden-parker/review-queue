import type { DiffSide, FileDiff, Note } from "@/lib/types";

type LineNote = Note & { path: string; line: number };

function isLineNote(note: Note): note is LineNote {
  return note.path !== null && note.line !== null;
}

type SideLines = Record<DiffSide, Set<number>>;

function linesBySide(files: readonly FileDiff[]): Map<string, SideLines> {
  const lines = new Map<string, SideLines>();
  for (const file of files) {
    const sides: SideLines = { old: new Set(), new: new Set() };
    for (const hunk of file.hunks) {
      for (const line of hunk.lines) {
        if (line.oldLine !== null) sides.old.add(line.oldLine);
        if (line.newLine !== null) sides.new.add(line.newLine);
      }
    }
    lines.set(file.path, sides);
  }
  return lines;
}

export function notesOffTheDiff(notes: readonly Note[], files: readonly FileDiff[]): Note[] {
  const lines = linesBySide(files);
  return notes
    .filter(isLineNote)
    .filter((note) => !lines.get(note.path)?.[note.side].has(note.line));
}

export function offTheDiffMessage(notes: readonly Note[]): string {
  const places = notes.map((note) => `${note.path}:${note.line}`).join(", ");
  return `${notes.length === 1 ? "This note points" : "These notes point"} at a line the diff no longer has: ${places}. Deselect or delete ${notes.length === 1 ? "it" : "them"} before posting.`;
}
