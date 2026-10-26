export type PullRequestRef = {
  owner: string;
  repo: string;
  number: number;
};

export type DiffLineKind = "add" | "del" | "context";

export type DiffLine = {
  kind: DiffLineKind;
  text: string;
  oldLine: number | null;
  newLine: number | null;
};

export type Hunk = {
  header: string;
  oldStart: number;
  newStart: number;
  lines: DiffLine[];
};

export type FileStatus = "added" | "deleted" | "modified" | "renamed";

export type FileDiff = {
  path: string;
  oldPath: string;
  status: FileStatus;
  binary: boolean;
  additions: number;
  deletions: number;
  hunks: Hunk[];
};

export type FileRole = "types" | "core" | "caller" | "test" | "config" | "docs" | "generated";

export type StepFile = {
  path: string;
  hunkIndexes: number[];
};

export type Step = {
  id: string;
  title: string;
  role: FileRole;
  reason: string;
  changedLines: number;
  files: StepFile[];
};

export type Severity = "high" | "medium" | "low";

export type Hotspot = {
  id: string;
  rule: string;
  severity: Severity;
  path: string;
  line: number | null;
  title: string;
  why: string;
};

export const SYMBOL_KINDS = [
  "function",
  "method",
  "class",
  "interface",
  "type",
  "enum",
  "variable",
  "constant",
  "parameter",
  "property",
  "module",
] as const;

export type SymbolKind = (typeof SYMBOL_KINDS)[number];

export type DefinitionScope = "file" | "repo" | "external";

export type SymbolDefinition = {
  name: string;
  kind: SymbolKind;
  path: string;
  line: number;
  endLine: number;
};

export type DiffSide = "old" | "new";

export type SymbolPosition = {
  name: string;
  path: string;
  line: number;
  character: number;
  side: DiffSide;
};

export type NoteKind = "blocker" | "question" | "nit" | "praise" | "parked";

export type Note = {
  id: number;
  path: string | null;
  line: number | null;
  kind: NoteKind;
  body: string;
  createdAt: string;
};
