import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import type { AssistThread, SavedAssistThread } from "@/lib/assist-protocol";
import { dataDirectory } from "@/lib/data-directory";
import type { ReviewEvent } from "@/lib/github/gh";
import type {
  DefinitionScope,
  Note,
  NoteDecoration,
  NoteKind,
  SymbolKind,
  SymbolPosition,
} from "@/lib/types";

export type Jump = { name: string; path: string; line: number };

export type SeenSymbol = {
  name: string;
  kind: SymbolKind;
  path: string;
  line: number;
  scope: DefinitionScope;
  signature: string;
  stepId: string | null;
  origin: SymbolPosition;
};

export type ContextSymbol = SeenSymbol & { pinned: boolean; seenAt: string };

export type PauseState = { note: string; at: string };

type Submission = {
  reviewId: number;
  url: string;
  event: ReviewEvent;
  headSha: string;
  body: string;
  postedAt: string;
};

type NewSubmission = Omit<Submission, "postedAt">;

export type ReplyReceipt = {
  replyId: number;
  parentCommentId: number;
  url: string;
  body: string;
  postedAt: string;
};

type NewReplyReceipt = Omit<ReplyReceipt, "postedAt">;

export type Session = {
  currentStepId: string | null;
  lastHeadSha: string | null;
  baselineHeadSha: string | null;
  updatedAt: string | null;
  pause: PauseState | null;
  doneSteps: string[];
  checkedHotspots: string[];
  notes: Note[];
  jumps: Jump[];
  assistThreads: SavedAssistThread[];
  contextSymbols: ContextSymbol[];
  submissions: Submission[];
  replyReceipts: ReplyReceipt[];
};

export type NewNote = {
  path: string | null;
  line: number | null;
  kind: NoteKind;
  decorations: NoteDecoration[];
  body: string;
};

export type NoteChange = Pick<Note, "kind" | "decorations" | "body">;

export type ProgressSummary = {
  doneCount: number;
  noteCount: number;
  lastHeadSha: string | null;
  updatedAt: string;
  pause: PauseState | null;
};

export type InProgressSession = {
  key: string;
  title: string | null;
  doneCount: number;
  pauseNote: string | null;
  updatedAt: string;
};

type InProgressRow = {
  pr_key: string;
  title: string | null;
  pause_note: string | null;
  updated_at: string;
  done_count: number;
};

export type RecentSubmission = {
  key: string;
  title: string | null;
  reviewId: number;
  url: string;
  event: ReviewEvent;
  postedAt: string;
};

type RecentSubmissionRow = {
  pr_key: string;
  title: string | null;
  review_id: number;
  url: string;
  event: ReviewEvent;
  posted_at: string;
};

type SessionRow = {
  current_step: string | null;
  head_sha: string | null;
  pause_note: string | null;
  paused_at: string | null;
  updated_at: string;
  title: string | null;
  finished_at: string | null;
};

type NoteRow = {
  id: number;
  path: string | null;
  line: number | null;
  kind: NoteKind;
  decorations: string;
  body: string;
  created_at: string;
};

const SCHEMA = `
CREATE TABLE IF NOT EXISTS sessions (
  pr_key TEXT PRIMARY KEY,
  current_step TEXT,
  head_sha TEXT,
  pause_note TEXT,
  paused_at TEXT,
  updated_at TEXT NOT NULL,
  title TEXT,
  finished_at TEXT,
  archived_at TEXT
);
CREATE TABLE IF NOT EXISTS review_baselines (
  pr_key TEXT PRIMARY KEY,
  head_sha TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS done_steps (
  pr_key TEXT NOT NULL,
  step_id TEXT NOT NULL,
  PRIMARY KEY (pr_key, step_id)
);
CREATE TABLE IF NOT EXISTS checked_hotspots (
  pr_key TEXT NOT NULL,
  hotspot_id TEXT NOT NULL,
  PRIMARY KEY (pr_key, hotspot_id)
);
CREATE TABLE IF NOT EXISTS notes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  pr_key TEXT NOT NULL,
  path TEXT,
  line INTEGER,
  kind TEXT NOT NULL,
  decorations TEXT NOT NULL DEFAULT '[]',
  body TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS jumps (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  pr_key TEXT NOT NULL,
  name TEXT NOT NULL,
  path TEXT NOT NULL,
  line INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS assist_threads (
  pr_key TEXT NOT NULL,
  id TEXT NOT NULL,
  head_sha TEXT NOT NULL,
  target TEXT NOT NULL,
  action TEXT NOT NULL,
  question TEXT,
  turns TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (pr_key, id)
);
CREATE TABLE IF NOT EXISTS context_symbols (
  pr_key TEXT NOT NULL,
  name TEXT NOT NULL,
  kind TEXT NOT NULL,
  path TEXT NOT NULL,
  line INTEGER NOT NULL,
  scope TEXT NOT NULL,
  signature TEXT NOT NULL,
  step_id TEXT,
  origin TEXT NOT NULL,
  pinned INTEGER NOT NULL DEFAULT 0,
  seen_at TEXT NOT NULL,
  PRIMARY KEY (pr_key, path, line, name)
);
CREATE TABLE IF NOT EXISTS cache (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS submissions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  pr_key TEXT NOT NULL,
  review_id INTEGER NOT NULL,
  url TEXT NOT NULL,
  event TEXT NOT NULL,
  head_sha TEXT NOT NULL,
  body TEXT NOT NULL,
  posted_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS notes_pr_key ON notes (pr_key);
CREATE INDEX IF NOT EXISTS jumps_pr_key ON jumps (pr_key);
CREATE INDEX IF NOT EXISTS submissions_pr_key ON submissions (pr_key);
CREATE TABLE IF NOT EXISTS reply_receipts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  pr_key TEXT NOT NULL,
  reply_id INTEGER NOT NULL,
  parent_comment_id INTEGER NOT NULL,
  url TEXT NOT NULL,
  body TEXT NOT NULL,
  posted_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS reply_receipts_by_pr ON reply_receipts (pr_key, id);
`;

const PROGRESS_TABLES = [
  "sessions",
  "review_baselines",
  "done_steps",
  "checked_hotspots",
  "jumps",
  "context_symbols",
];
const MAX_UNPINNED_SYMBOLS = 50;

type AssistThreadRow = {
  id: string;
  head_sha: string;
  target: string;
  action: AssistThread["action"];
  question: string | null;
  turns: string;
  updated_at: string;
};

const UPSERT_ASSIST_THREAD = `
INSERT INTO assist_threads (pr_key, id, head_sha, target, action, question, turns, updated_at)
VALUES (:key, :id, :headSha, :target, :action, :question, :turns, :updatedAt)
ON CONFLICT (pr_key, id) DO UPDATE SET
  head_sha = excluded.head_sha,
  target = excluded.target,
  action = excluded.action,
  question = excluded.question,
  turns = excluded.turns,
  updated_at = excluded.updated_at`;

type ContextSymbolRow = Omit<SeenSymbol, "stepId" | "origin"> & {
  step_id: string | null;
  origin: string;
  pinned: number;
  seen_at: string;
};

const UPSERT_SYMBOL = `
INSERT INTO context_symbols
  (pr_key, name, kind, path, line, scope, signature, step_id, origin, pinned, seen_at)
VALUES
  (:key, :name, :kind, :path, :line, :scope, :signature, :stepId, :origin, COALESCE(:pinned, 0), :seenAt)
ON CONFLICT (pr_key, path, line, name) DO UPDATE SET
  kind = excluded.kind,
  scope = excluded.scope,
  signature = excluded.signature,
  step_id = excluded.step_id,
  origin = excluded.origin,
  pinned = COALESCE(:pinned, context_symbols.pinned),
  seen_at = excluded.seen_at`;

const PRUNE_SYMBOLS = `
DELETE FROM context_symbols WHERE pr_key = :key AND pinned = 0 AND rowid NOT IN (
  SELECT rowid FROM context_symbols WHERE pr_key = :key AND pinned = 0
  ORDER BY seen_at DESC LIMIT :limit
)`;

function progressSessionsQuery(archivedFilter: "IS NULL" | "IS NOT NULL"): string {
  return `
SELECT s.pr_key, s.title, s.pause_note, s.updated_at,
  (SELECT COUNT(*) FROM done_steps d WHERE d.pr_key = s.pr_key) AS done_count,
  (SELECT COUNT(*) FROM notes n WHERE n.pr_key = s.pr_key) AS note_count
FROM sessions s
WHERE s.finished_at IS NULL
  AND s.archived_at ${archivedFilter}
  AND (done_count > 0 OR note_count > 0 OR s.pause_note IS NOT NULL)
ORDER BY s.updated_at DESC`;
}

const IN_PROGRESS = progressSessionsQuery("IS NULL");
const ARCHIVED = progressSessionsQuery("IS NOT NULL");

const RECENT_SUBMISSIONS = `
SELECT r.pr_key, s.title, r.review_id, r.url, r.event, r.posted_at
FROM submissions r
LEFT JOIN sessions s ON s.pr_key = r.pr_key
ORDER BY r.id DESC
LIMIT ?`;

function pauseOf(row: SessionRow | undefined): PauseState | null {
  return row?.pause_note != null ? { note: row.pause_note, at: row.paused_at ?? "" } : null;
}

function toInProgress(row: InProgressRow): InProgressSession {
  return {
    key: row.pr_key,
    title: row.title,
    doneCount: row.done_count,
    pauseNote: row.pause_note,
    updatedAt: row.updated_at,
  };
}

function toRecentSubmission(row: RecentSubmissionRow): RecentSubmission {
  return {
    key: row.pr_key,
    title: row.title,
    reviewId: row.review_id,
    url: row.url,
    event: row.event,
    postedAt: row.posted_at,
  };
}

export function defaultDatabasePath(): string {
  return path.join(dataDirectory(), "review-queue.db");
}

function migrateNotes(db: DatabaseSync): void {
  const columns = db.prepare("PRAGMA table_info(notes)").all() as { name: string }[];
  if (!columns.some((column) => column.name === "decorations")) {
    db.exec("ALTER TABLE notes ADD COLUMN decorations TEXT NOT NULL DEFAULT '[]'");
  }
  db.exec(
    `UPDATE notes SET kind = 'issue', decorations = '["blocking"]' WHERE kind = 'blocker';
     UPDATE notes SET kind = 'nitpick' WHERE kind = 'nit';`,
  );
}

function ensureColumn(db: DatabaseSync, table: string, column: string, type: string): void {
  const columns = db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[];
  if (columns.some((existing) => existing.name === column)) return;
  db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${type}`);
}

const BUSY_TIMEOUT_MS = 5000;
const PRIVATE_DIRECTORY_MODE = 0o700;
const PRIVATE_FILE_MODE = 0o600;

function createPrivateFile(file: string): void {
  fs.closeSync(fs.openSync(file, "a", PRIVATE_FILE_MODE));
}

function restrictToOwner(file: string): void {
  for (const candidate of [file, `${file}-wal`, `${file}-shm`]) {
    if (fs.existsSync(candidate)) fs.chmodSync(candidate, PRIVATE_FILE_MODE);
  }
}

function openDatabase(file: string): DatabaseSync {
  const isFile = file !== ":memory:";
  if (isFile) {
    fs.mkdirSync(path.dirname(file), { recursive: true, mode: PRIVATE_DIRECTORY_MODE });
    createPrivateFile(file);
  }
  const db = new DatabaseSync(file);
  db.exec(`PRAGMA busy_timeout = ${BUSY_TIMEOUT_MS}; PRAGMA journal_mode = WAL;`);
  if (isFile) restrictToOwner(file);
  db.exec(SCHEMA);
  migrateNotes(db);
  ensureColumn(db, "sessions", "title", "TEXT");
  ensureColumn(db, "sessions", "finished_at", "TEXT");
  ensureColumn(db, "sessions", "archived_at", "TEXT");
  return db;
}

function toContextSymbol(row: ContextSymbolRow): ContextSymbol {
  return {
    name: row.name,
    kind: row.kind,
    path: row.path,
    line: row.line,
    scope: row.scope,
    signature: row.signature,
    stepId: row.step_id,
    origin: JSON.parse(row.origin) as SymbolPosition,
    pinned: row.pinned === 1,
    seenAt: row.seen_at,
  };
}

type SubmissionRow = {
  review_id: number;
  url: string;
  event: ReviewEvent;
  head_sha: string;
  body: string;
  posted_at: string;
};

function toSubmission(row: SubmissionRow): Submission {
  return {
    reviewId: row.review_id,
    url: row.url,
    event: row.event,
    headSha: row.head_sha,
    body: row.body,
    postedAt: row.posted_at,
  };
}

type ReplyReceiptRow = {
  reply_id: number;
  parent_comment_id: number;
  url: string;
  body: string;
  posted_at: string;
};

function toReplyReceipt(row: ReplyReceiptRow): ReplyReceipt {
  return {
    replyId: row.reply_id,
    parentCommentId: row.parent_comment_id,
    url: row.url,
    body: row.body,
    postedAt: row.posted_at,
  };
}

function toNote(row: NoteRow): Note {
  return {
    id: row.id,
    path: row.path,
    line: row.line,
    kind: row.kind,
    decorations: JSON.parse(row.decorations) as NoteDecoration[],
    body: row.body,
    createdAt: row.created_at,
  };
}

export class SessionStore {
  private readonly db: DatabaseSync;

  constructor(
    file: string = defaultDatabasePath(),
    private readonly clock: () => Date = () => new Date(),
  ) {
    this.db = openDatabase(file);
  }

  getSession(key: string): Session {
    const row = this.db.prepare("SELECT * FROM sessions WHERE pr_key = ?").get(key) as
      SessionRow | undefined;
    return {
      currentStepId: row?.current_step ?? null,
      lastHeadSha: row?.head_sha ?? null,
      baselineHeadSha: this.headFrom("SELECT head_sha FROM review_baselines WHERE pr_key = ?", key),
      updatedAt: row?.updated_at ?? null,
      pause: pauseOf(row),
      doneSteps: this.column(
        "SELECT step_id AS v FROM done_steps WHERE pr_key = ? ORDER BY rowid",
        key,
      ),
      checkedHotspots: this.column(
        "SELECT hotspot_id AS v FROM checked_hotspots WHERE pr_key = ? ORDER BY rowid",
        key,
      ),
      notes: this.notes(key),
      jumps: this.jumps(key),
      assistThreads: this.assistThreads(key),
      contextSymbols: this.contextSymbols(key),
      submissions: this.submissions(key),
      replyReceipts: this.replyReceipts(key),
    };
  }

  setCurrentStep(key: string, stepId: string): void {
    this.touch(key);
    this.db.prepare("UPDATE sessions SET current_step = ? WHERE pr_key = ?").run(stepId, key);
  }

  markSeen(key: string, headSha: string): void {
    this.touch(key);
    const previousHead = this.headFrom("SELECT head_sha FROM sessions WHERE pr_key = ?", key);
    if (previousHead && previousHead !== headSha) this.recordPush(key, previousHead);
    this.db.prepare("UPDATE sessions SET head_sha = ? WHERE pr_key = ?").run(headSha, key);
  }

  catchUp(key: string): void {
    this.db.prepare("DELETE FROM review_baselines WHERE pr_key = ?").run(key);
  }

  setStepDone(key: string, stepId: string, done: boolean): void {
    this.touch(key);
    this.toggleRow("done_steps", "step_id", key, stepId, done);
  }

  setHotspotChecked(key: string, hotspotId: string, checked: boolean): void {
    this.touch(key);
    this.toggleRow("checked_hotspots", "hotspot_id", key, hotspotId, checked);
  }

  addNote(key: string, note: NewNote): Note {
    this.touch(key);
    const createdAt = this.now();
    const result = this.db
      .prepare(
        "INSERT INTO notes (pr_key, path, line, kind, decorations, body, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
      )
      .run(
        key,
        note.path,
        note.line,
        note.kind,
        JSON.stringify(note.decorations),
        note.body,
        createdAt,
      );
    return {
      id: Number(result.lastInsertRowid),
      path: note.path,
      line: note.line,
      kind: note.kind,
      decorations: note.decorations,
      body: note.body,
      createdAt,
    };
  }

  updateNote(key: string, id: number, change: NoteChange): void {
    this.touch(key);
    this.db
      .prepare("UPDATE notes SET kind = ?, decorations = ?, body = ? WHERE pr_key = ? AND id = ?")
      .run(change.kind, JSON.stringify(change.decorations), change.body, key, id);
  }

  deleteNote(key: string, id: number): void {
    this.db.prepare("DELETE FROM notes WHERE pr_key = ? AND id = ?").run(key, id);
  }

  recordSubmission(key: string, submission: NewSubmission): void {
    this.db
      .prepare(
        "INSERT INTO submissions (pr_key, review_id, url, event, head_sha, body, posted_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
      )
      .run(
        key,
        submission.reviewId,
        submission.url,
        submission.event,
        submission.headSha,
        submission.body,
        this.now(),
      );
  }

  recordReply(key: string, reply: NewReplyReceipt): void {
    this.db
      .prepare(
        "INSERT INTO reply_receipts (pr_key, reply_id, parent_comment_id, url, body, posted_at) VALUES (?, ?, ?, ?, ?, ?)",
      )
      .run(key, reply.replyId, reply.parentCommentId, reply.url, reply.body, this.now());
  }

  pause(key: string, note: string): void {
    this.touch(key);
    this.db
      .prepare("UPDATE sessions SET pause_note = ?, paused_at = ? WHERE pr_key = ?")
      .run(note, this.now(), key);
  }

  resume(key: string): void {
    this.touch(key);
    this.db
      .prepare("UPDATE sessions SET pause_note = NULL, paused_at = NULL WHERE pr_key = ?")
      .run(key);
  }

  pushJump(key: string, jump: Jump): void {
    this.touch(key);
    this.db
      .prepare("INSERT INTO jumps (pr_key, name, path, line) VALUES (?, ?, ?, ?)")
      .run(key, jump.name, jump.path, jump.line);
  }

  popJump(key: string): Jump | null {
    const row = this.db
      .prepare("SELECT id, name, path, line FROM jumps WHERE pr_key = ? ORDER BY id DESC LIMIT 1")
      .get(key) as (Jump & { id: number }) | undefined;
    if (!row) return null;
    this.db.prepare("DELETE FROM jumps WHERE id = ?").run(row.id);
    return { name: row.name, path: row.path, line: row.line };
  }

  clearJumps(key: string): void {
    this.db.prepare("DELETE FROM jumps WHERE pr_key = ?").run(key);
  }

  saveAssistThread(key: string, thread: AssistThread): void {
    this.db.prepare(UPSERT_ASSIST_THREAD).run({
      key,
      id: thread.id,
      headSha: thread.headSha,
      target: JSON.stringify(thread.target),
      action: thread.action,
      question: thread.question,
      turns: JSON.stringify(thread.turns),
      updatedAt: this.now(),
    });
  }

  deleteAssistThread(key: string, id: string): void {
    this.db.prepare("DELETE FROM assist_threads WHERE pr_key = ? AND id = ?").run(key, id);
  }

  recordSymbolSeen(key: string, symbol: SeenSymbol): void {
    this.touch(key);
    this.upsertSymbol(key, symbol, null);
    this.db.prepare(PRUNE_SYMBOLS).run({ key, limit: MAX_UNPINNED_SYMBOLS });
  }

  setSymbolPinned(key: string, symbol: SeenSymbol, pinned: boolean): void {
    this.touch(key);
    this.upsertSymbol(key, symbol, pinned ? 1 : 0);
  }

  startOver(key: string, keepNotes: boolean): void {
    const tables = keepNotes ? PROGRESS_TABLES : [...PROGRESS_TABLES, "notes", "assist_threads"];
    this.transaction(() => {
      for (const table of tables) {
        this.db.prepare(`DELETE FROM ${table} WHERE pr_key = ?`).run(key);
      }
    });
  }

  getCached(key: string): string | null {
    const row = this.db.prepare("SELECT value FROM cache WHERE key = ?").get(key) as
      { value: string } | undefined;
    return row?.value ?? null;
  }

  setCached(key: string, value: string): void {
    this.db
      .prepare(
        "INSERT INTO cache (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = ?",
      )
      .run(key, value, value);
  }

  clearCache(): number {
    return Number(this.db.prepare("DELETE FROM cache").run().changes);
  }

  getSetting(key: string): string | null {
    const row = this.db.prepare("SELECT value FROM settings WHERE key = ?").get(key) as
      { value: string } | undefined;
    return row?.value ?? null;
  }

  setSetting(key: string, value: string): void {
    this.db
      .prepare(
        "INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = ?",
      )
      .run(key, value, value);
  }

  progressSummaries(keys: string[]): Record<string, ProgressSummary> {
    const summaries: Record<string, ProgressSummary> = {};
    for (const key of keys) {
      const session = this.getSession(key);
      if (!session.updatedAt) continue;
      summaries[key] = {
        doneCount: session.doneSteps.length,
        noteCount: session.notes.length,
        lastHeadSha: session.lastHeadSha,
        updatedAt: session.updatedAt,
        pause: session.pause,
      };
    }
    return summaries;
  }

  rememberTitle(key: string, title: string): void {
    this.touch(key);
    this.db.prepare("UPDATE sessions SET title = ? WHERE pr_key = ?").run(title, key);
  }

  markFinished(key: string): void {
    this.touch(key);
    this.db.prepare("UPDATE sessions SET finished_at = ? WHERE pr_key = ?").run(this.now(), key);
  }

  archive(key: string): void {
    this.db.prepare("UPDATE sessions SET archived_at = ? WHERE pr_key = ?").run(this.now(), key);
  }

  unarchive(key: string): void {
    this.db.prepare("UPDATE sessions SET archived_at = NULL WHERE pr_key = ?").run(key);
  }

  archived(): InProgressSession[] {
    return (this.db.prepare(ARCHIVED).all() as InProgressRow[]).map(toInProgress);
  }

  inProgress(): InProgressSession[] {
    return (this.db.prepare(IN_PROGRESS).all() as InProgressRow[]).map(toInProgress);
  }

  recentSubmissions(limit: number): RecentSubmission[] {
    return (this.db.prepare(RECENT_SUBMISSIONS).all(limit) as RecentSubmissionRow[]).map(
      toRecentSubmission,
    );
  }

  private transaction(work: () => void): void {
    this.db.exec("BEGIN IMMEDIATE");
    try {
      work();
      this.db.exec("COMMIT");
    } catch (error) {
      this.db.exec("ROLLBACK");
      throw error;
    }
  }

  private now(): string {
    return this.clock().toISOString();
  }

  private touch(key: string): void {
    this.db
      .prepare(
        "INSERT INTO sessions (pr_key, updated_at) VALUES (?, ?) ON CONFLICT(pr_key) DO UPDATE SET updated_at = excluded.updated_at",
      )
      .run(key, this.now());
  }

  private toggleRow(table: string, column: string, key: string, value: string, on: boolean): void {
    const statement = on
      ? `INSERT OR IGNORE INTO ${table} (pr_key, ${column}) VALUES (?, ?)`
      : `DELETE FROM ${table} WHERE pr_key = ? AND ${column} = ?`;
    this.db.prepare(statement).run(key, value);
  }

  private headFrom(sql: string, key: string): string | null {
    const row = this.db.prepare(sql).get(key) as { head_sha: string | null } | undefined;
    return row?.head_sha ?? null;
  }

  private recordPush(key: string, previousHead: string): void {
    this.db
      .prepare("INSERT OR IGNORE INTO review_baselines (pr_key, head_sha) VALUES (?, ?)")
      .run(key, previousHead);
    this.db
      .prepare("UPDATE sessions SET finished_at = NULL, archived_at = NULL WHERE pr_key = ?")
      .run(key);
  }

  private column(sql: string, key: string): string[] {
    return (this.db.prepare(sql).all(key) as { v: string }[]).map((row) => row.v);
  }

  private submissions(key: string): Submission[] {
    const rows = this.db
      .prepare("SELECT * FROM submissions WHERE pr_key = ? ORDER BY id DESC")
      .all(key) as SubmissionRow[];
    return rows.map(toSubmission);
  }

  private replyReceipts(key: string): ReplyReceipt[] {
    const rows = this.db
      .prepare("SELECT * FROM reply_receipts WHERE pr_key = ? ORDER BY id DESC")
      .all(key) as ReplyReceiptRow[];
    return rows.map(toReplyReceipt);
  }

  private notes(key: string): Note[] {
    const rows = this.db
      .prepare("SELECT * FROM notes WHERE pr_key = ? ORDER BY id")
      .all(key) as NoteRow[];
    return rows.map(toNote);
  }

  private assistThreads(key: string): SavedAssistThread[] {
    const rows = this.db
      .prepare("SELECT * FROM assist_threads WHERE pr_key = ? ORDER BY updated_at DESC, rowid DESC")
      .all(key) as AssistThreadRow[];
    return rows.map((row) => ({
      id: row.id,
      headSha: row.head_sha,
      target: JSON.parse(row.target),
      action: row.action,
      question: row.question,
      turns: JSON.parse(row.turns),
      updatedAt: row.updated_at,
    }));
  }

  private upsertSymbol(key: string, symbol: SeenSymbol, pinned: number | null): void {
    this.db.prepare(UPSERT_SYMBOL).run({
      key,
      ...symbol,
      origin: JSON.stringify(symbol.origin),
      pinned,
      seenAt: this.now(),
    });
  }

  private contextSymbols(key: string): ContextSymbol[] {
    const rows = this.db
      .prepare("SELECT * FROM context_symbols WHERE pr_key = ? ORDER BY seen_at DESC, rowid DESC")
      .all(key) as ContextSymbolRow[];
    return rows.map(toContextSymbol);
  }

  private jumps(key: string): Jump[] {
    return this.db
      .prepare("SELECT name, path, line FROM jumps WHERE pr_key = ? ORDER BY id")
      .all(key) as Jump[];
  }
}
