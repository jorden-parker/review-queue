import type { SessionAction } from "@/lib/review/session-actions";
import type { Session } from "@/lib/session/store";
import type { Note } from "@/lib/types";

export type OptimisticChange = (session: Session, temporaryNoteId: number) => Session;

type PendingChange = { seq: number; temporaryNoteId: number; optimistic?: OptimisticChange };

export type SessionLedger = {
  confirmed: Session | null;
  appliedSeq: number;
  pending: PendingChange[];
};

type AddedNote = Extract<SessionAction, { type: "note-add" }>;

export function createSerialQueue() {
  let tail: Promise<unknown> = Promise.resolve();
  return {
    run<T>(task: () => Promise<T>): Promise<T> {
      const result = tail.then(task);
      tail = result.catch(() => undefined);
      return result;
    },
  };
}

export function createTemporaryIds(): () => number {
  let issued = 0;
  return () => {
    issued += 1;
    return -issued;
  };
}

function isAddedNote(note: Note, added: AddedNote): boolean {
  return (
    note.path === added.path &&
    note.line === added.line &&
    note.kind === added.kind &&
    note.body === added.body.trim() &&
    JSON.stringify(note.decorations) === JSON.stringify(added.decorations)
  );
}

export function serverIdOfAddedNote(session: Session, added: AddedNote): number | null {
  const ids = session.notes.filter((note) => isAddedNote(note, added)).map((note) => note.id);
  return ids.length === 0 ? null : Math.max(...ids);
}

export function withServerNoteId(
  action: SessionAction,
  serverIds: ReadonlyMap<number, number>,
): SessionAction | null {
  if (action.type !== "note-edit" && action.type !== "note-delete") return action;
  if (action.id > 0) return action;
  const serverId = serverIds.get(action.id);
  return serverId === undefined ? null : { ...action, id: serverId };
}

export function visibleSession(ledger: SessionLedger): Session | null {
  if (!ledger.confirmed) return null;
  return ledger.pending.reduce<Session>(
    (session, change) => change.optimistic?.(session, change.temporaryNoteId) ?? session,
    ledger.confirmed,
  );
}

export function settleAnswered(
  ledger: SessionLedger,
  seq: number,
  session: Session,
): SessionLedger {
  const pending = ledger.pending.filter((change) => change.seq !== seq);
  if (seq <= ledger.appliedSeq) return { ...ledger, pending };
  return { ...ledger, pending, confirmed: session, appliedSeq: seq };
}

export function settleRefused(ledger: SessionLedger, seq: number): SessionLedger {
  return { ...ledger, pending: ledger.pending.filter((change) => change.seq !== seq) };
}
