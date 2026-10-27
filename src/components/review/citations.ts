import type { PreparedFile } from "@/lib/review/prepare";

export type Citation = { path: string; line: number; endLine: number; inDiff: boolean };

type Span = { path: string | undefined; start: number; end: number };

const MAX_SPAN_LINES = 200;
const PATH_FORM = /^(.+?)(?::|#L)(\d+)(?:-L?(\d+))?$/;
const BARE_FORM = /^L(\d+)(?:-L?(\d+))?$/;

function spanFrom(path: string | undefined, startText: string, endText?: string): Span {
  const start = Number(startText);
  return { path, start, end: endText === undefined ? start : Number(endText) };
}

function parseSpan(code: string): Span | null {
  const pathMatch = PATH_FORM.exec(code);
  if (pathMatch) return spanFrom(pathMatch[1], pathMatch[2], pathMatch[3]);
  const bareMatch = BARE_FORM.exec(code);
  if (bareMatch) return spanFrom(undefined, bareMatch[1], bareMatch[2]);
  return null;
}

function resolvePath(path: string, knownPaths: string[]): string | null {
  if (knownPaths.includes(path)) return path;
  const suffixMatches = knownPaths.filter((known) => known.endsWith(`/${path}`));
  return suffixMatches.length === 1 ? suffixMatches[0] : null;
}

function orderedRange(start: number, end: number): { line: number; endLine: number } {
  const low = Math.min(start, end);
  const high = Math.max(start, end);
  return { line: low, endLine: Math.min(high, low + MAX_SPAN_LINES) };
}

function lineInDiff(files: PreparedFile[], path: string, line: number): boolean {
  const file = files.find((candidate) => candidate.path === path);
  return (
    file?.hunks.some((hunk) => hunk.lines.some((diffLine) => diffLine.newLine === line)) ?? false
  );
}

export function parseCitation(
  code: string,
  knownPaths: string[],
  defaultPath: string,
  files: PreparedFile[],
): Citation | null {
  const span = parseSpan(code.trim());
  if (!span) return null;
  const path = resolvePath(span.path ?? defaultPath, knownPaths);
  if (path === null) return null;
  const { line, endLine } = orderedRange(span.start, span.end);
  if (line < 1) return null;
  return { path, line, endLine, inDiff: lineInDiff(files, path, line) };
}
