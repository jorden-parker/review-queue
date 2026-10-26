import type { DiffLine, FileDiff, Hunk } from "@/lib/types";

const FILE_HEADER = /^diff --git a\/(.+) b\/(.+)$/;
const HUNK_HEADER = /^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@ ?(.*)$/;

type Cursor = { oldLine: number; newLine: number };

function newFile(oldPath: string, path: string): FileDiff {
  return {
    path,
    oldPath,
    status: "modified",
    binary: false,
    additions: 0,
    deletions: 0,
    hunks: [],
  };
}

function newHunk(match: RegExpMatchArray): Hunk {
  return { header: match[3], oldStart: Number(match[1]), newStart: Number(match[2]), lines: [] };
}

function applyMetadata(file: FileDiff, line: string): void {
  if (line.startsWith("new file mode")) file.status = "added";
  if (line.startsWith("deleted file mode")) file.status = "deleted";
  if (line.startsWith("rename from ")) {
    file.oldPath = line.slice("rename from ".length);
    file.status = "renamed";
  }
  if (line.startsWith("rename to ")) file.path = line.slice("rename to ".length);
  if (line.startsWith("Binary files ")) file.binary = true;
}

function diffLine(line: string, cursor: Cursor): DiffLine | null {
  const marker = line[0];
  const text = line.slice(1);
  if (marker === "+") return { kind: "add", text, oldLine: null, newLine: cursor.newLine++ };
  if (marker === "-") return { kind: "del", text, oldLine: cursor.oldLine++, newLine: null };
  if (marker === " ")
    return { kind: "context", text, oldLine: cursor.oldLine++, newLine: cursor.newLine++ };
  return null;
}

function countLine(file: FileDiff, line: DiffLine): void {
  if (line.kind === "add") file.additions++;
  if (line.kind === "del") file.deletions++;
}

export function parseUnifiedDiff(text: string): FileDiff[] {
  const files: FileDiff[] = [];
  let file: FileDiff | null = null;
  let hunk: Hunk | null = null;
  const cursor: Cursor = { oldLine: 0, newLine: 0 };

  for (const line of text.split("\n")) {
    const fileMatch = line.match(FILE_HEADER);
    if (fileMatch) {
      file = newFile(fileMatch[1], fileMatch[2]);
      files.push(file);
      hunk = null;
      continue;
    }
    if (!file) continue;
    const hunkMatch = line.match(HUNK_HEADER);
    if (hunkMatch) {
      hunk = newHunk(hunkMatch);
      file.hunks.push(hunk);
      cursor.oldLine = hunk.oldStart;
      cursor.newLine = hunk.newStart;
      continue;
    }
    if (!hunk) {
      applyMetadata(file, line);
      continue;
    }
    const parsed = diffLine(line, cursor);
    if (!parsed) continue;
    hunk.lines.push(parsed);
    countLine(file, parsed);
  }
  return files;
}
