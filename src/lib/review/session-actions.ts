import { z } from "zod";
import { ASSIST_ACTIONS, MAX_HISTORY_TURNS } from "@/lib/assist-protocol";
import type { Session, SessionStore } from "@/lib/session/store";
import { AssistTargetSchema } from "./assist-request";

const CommitShaSchema = z.string().regex(/^(?:[0-9a-f]{40}|[0-9a-f]{64})$/);
const NoteKindSchema = z.enum(["blocker", "question", "nit", "praise", "parked"]);

const AssistThreadSchema = z.object({
  id: z.uuid(),
  headSha: CommitShaSchema,
  target: AssistTargetSchema,
  action: z.enum(ASSIST_ACTIONS),
  question: z.string().max(2_000).nullable(),
  turns: z
    .array(z.object({ role: z.enum(["reviewer", "model"]), text: z.string().max(16_000) }))
    .max(MAX_HISTORY_TURNS + 2),
});

export const SessionActionSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("current-step"), stepId: z.string(), headSha: CommitShaSchema }),
  z.object({ type: z.literal("step-done"), stepId: z.string(), done: z.boolean() }),
  z.object({ type: z.literal("hotspot-checked"), hotspotId: z.string(), checked: z.boolean() }),
  z.object({
    type: z.literal("note-add"),
    path: z.string().nullable(),
    line: z.number().int().positive().nullable(),
    kind: NoteKindSchema,
    body: z.string().trim().min(1),
  }),
  z.object({ type: z.literal("note-delete"), id: z.number().int() }),
  z.object({ type: z.literal("pause"), note: z.string() }),
  z.object({ type: z.literal("resume") }),
  z.object({
    type: z.literal("jump-push"),
    name: z.string(),
    path: z.string(),
    line: z.number().int(),
  }),
  z.object({ type: z.literal("jump-pop") }),
  z.object({ type: z.literal("jump-clear") }),
  z.object({ type: z.literal("start-over"), keepNotes: z.boolean() }),
  z.object({ type: z.literal("assist-save"), thread: AssistThreadSchema }),
  z.object({ type: z.literal("assist-delete"), id: z.uuid() }),
]);

export type SessionAction = z.infer<typeof SessionActionSchema>;

type Handler<Action> = (store: SessionStore, key: string, action: Action) => void;

type Handlers = {
  [Type in SessionAction["type"]]: Handler<Extract<SessionAction, { type: Type }>>;
};

const HANDLERS: Handlers = {
  "current-step": (store, key, action) => store.setCurrentStep(key, action.stepId, action.headSha),
  "step-done": (store, key, action) => store.setStepDone(key, action.stepId, action.done),
  "hotspot-checked": (store, key, action) =>
    store.setHotspotChecked(key, action.hotspotId, action.checked),
  "note-add": (store, key, action) => {
    store.addNote(key, action);
  },
  "note-delete": (store, key, action) => store.deleteNote(key, action.id),
  pause: (store, key, action) => store.pause(key, action.note),
  resume: (store, key) => store.resume(key),
  "jump-push": (store, key, action) => store.pushJump(key, action),
  "jump-pop": (store, key) => {
    store.popJump(key);
  },
  "jump-clear": (store, key) => store.clearJumps(key),
  "start-over": (store, key, action) => store.startOver(key, action.keepNotes),
  "assist-save": (store, key, action) => store.saveAssistThread(key, action.thread),
  "assist-delete": (store, key, action) => store.deleteAssistThread(key, action.id),
};

function apply(store: SessionStore, key: string, action: SessionAction): void {
  const handler = HANDLERS[action.type] as Handler<SessionAction>;
  handler(store, key, action);
}

export function applySessionAction(
  store: SessionStore,
  key: string,
  action: SessionAction,
): Session {
  apply(store, key, action);
  return store.getSession(key);
}
