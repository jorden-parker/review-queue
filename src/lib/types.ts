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

export const RULE_IDS = [
  "runs-commands",
  "sql-strings",
  "hardcoded-secret",
  "raw-html",
  "auth-crypto",
  "concurrency",
  "swallowed-error",
  "magic-value",
  "todo",
  "debug-output",
  "suppression",
  "commented-code",
  "signature-change",
  "busy-function-change",
  "big-hunk",
  "branching",
  "migration",
  "tests-removed",
  "dependencies",
  "lockfile-drift",
  "churn",
  "no-tests",
  "ai",
] as const;

export type RuleId = (typeof RULE_IDS)[number];

export type Hotspot = {
  id: string;
  rule: RuleId;
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

export type OutlineSymbol = SymbolDefinition & { children: OutlineSymbol[] };

export type ReferenceCount = {
  name: string;
  line: number;
  character: number;
  count: number;
  capped?: true;
};

export type DiffSide = "old" | "new";

export type SymbolPosition = {
  name: string;
  path: string;
  line: number;
  character: number;
  side: DiffSide;
};

export const NOTE_LABELS = [
  "praise",
  "nitpick",
  "suggestion",
  "issue",
  "todo",
  "question",
  "thought",
  "chore",
  "note",
  "typo",
  "polish",
  "quibble",
] as const;

export type NoteLabel = (typeof NOTE_LABELS)[number];

export type NoteKind = NoteLabel | "parked";

export const NOTE_DECORATIONS = ["blocking", "non-blocking", "if-minor"] as const;

export type NoteDecoration = (typeof NOTE_DECORATIONS)[number];

export type NoteTag = { kind: NoteKind; decorations: NoteDecoration[] };

export type Note = {
  id: number;
  path: string | null;
  line: number | null;
  kind: NoteKind;
  decorations: NoteDecoration[];
  body: string;
  createdAt: string;
};

export type ChangeNode = {
  id: string;
  path: string;
  name: string | null;
  kind: SymbolKind | "file";
  role: FileRole;
  line: number;
  hunkIndexes: number[];
  stepId: string | null;
};

export type ChangeEdge = { from: string; to: string };

export type ChangeThread = { id: string; entryId: string; nodeIds: string[]; testIds: string[] };

export type ChangeMap = {
  nodes: ChangeNode[];
  edges: ChangeEdge[];
  threads: ChangeThread[];
  orphanIds: string[];
};
