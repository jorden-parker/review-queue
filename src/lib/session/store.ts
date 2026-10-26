import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { dataDirectory } from "@/lib/data-directory";
import type { Note, NoteKind } from "@/lib/types";

export type Jump = { name: string; path: string; line: number };

export type PauseState = { note: string; at: string };

export type Session = {
  currentStepId: string | null;
  lastHeadSha: string | null;
  updatedAt: string | null;
  pause: PauseState | null;
  doneSteps: string[];
  checkedHotspots: string[];
  notes: Note[];
  jumps: Jump[];
};

export type NewNote = { path: string | null; line: number | null; kind: NoteKind; body: string };

export type ProgressSummary = { doneCount: number; lastHeadSha: string | null; updatedAt: string };

type SessionRow = {
  current_step: string | null;
  head_sha: string | null;
  pause_note: string | null;
  paused_at: string | null;
  updated_at: string;
};

type NoteRow = {
  id: number;
  path: string | null;
  line: number | null;
  kind: NoteKind;
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
  updated_at TEXT NOT NULL
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
CREATE TABLE IF NOT EXISTS cache (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
`;

export function defaultDatabasePath(): string {
  return path.join(dataDirectory(), "review-queue.db");
}

function openDatabase(file: string): DatabaseSync {
  if (file !== ":memory:") fs.mkdirSync(path.dirname(file), { recursive: true });
  const db = new DatabaseSync(file);
  db.exec(SCHEMA);
  return db;
}

function toNote(row: NoteRow): Note {
  return {
    id: row.id,
    path: row.path,
    line: row.line,
    kind: row.kind,
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
      updatedAt: row?.updated_at ?? null,
      pause: row?.pause_note != null ? { note: row.pause_note, at: row.paused_at ?? "" } : null,
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
    };
  }

  setCurrentStep(key: string, stepId: string, headSha: string): void {
    this.touch(key);
    this.db
      .prepare("UPDATE sessions SET current_step = ?, head_sha = ? WHERE pr_key = ?")
      .run(stepId, headSha, key);
  }

  markSeen(key: string, headSha: string): void {
    this.touch(key);
    this.db.prepare("UPDATE sessions SET head_sha = ? WHERE pr_key = ?").run(headSha, key);
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
        "INSERT INTO notes (pr_key, path, line, kind, body, created_at) VALUES (?, ?, ?, ?, ?, ?)",
      )
      .run(key, note.path, note.line, note.kind, note.body, createdAt);
    return { ...note, id: Number(result.lastInsertRowid), createdAt };
  }

  deleteNote(key: string, id: number): void {
    this.db.prepare("DELETE FROM notes WHERE pr_key = ? AND id = ?").run(key, id);
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

  progressSummaries(keys: string[]): Record<string, ProgressSummary> {
    const summaries: Record<string, ProgressSummary> = {};
    for (const key of keys) {
      const session = this.getSession(key);
      if (!session.updatedAt) continue;
      summaries[key] = {
        doneCount: session.doneSteps.length,
        lastHeadSha: session.lastHeadSha,
        updatedAt: session.updatedAt,
      };
    }
    return summaries;
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

  private column(sql: string, key: string): string[] {
    return (this.db.prepare(sql).all(key) as { v: string }[]).map((row) => row.v);
  }

  private notes(key: string): Note[] {
    const rows = this.db
      .prepare("SELECT * FROM notes WHERE pr_key = ? ORDER BY id")
      .all(key) as NoteRow[];
    return rows.map(toNote);
  }

  private jumps(key: string): Jump[] {
    return this.db
      .prepare("SELECT name, path, line FROM jumps WHERE pr_key = ? ORDER BY id")
      .all(key) as Jump[];
  }
}
