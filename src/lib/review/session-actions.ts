import { z } from "zod";
import type { Session, SessionStore } from "@/lib/session/store";

const NoteKindSchema = z.enum(["blocker", "question", "nit", "praise", "parked"]);

export const SessionActionSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("current-step"), stepId: z.string(), headSha: z.string() }),
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
]);

export type SessionAction = z.infer<typeof SessionActionSchema>;

function apply(store: SessionStore, key: string, action: SessionAction): void {
  switch (action.type) {
    case "current-step":
      return store.setCurrentStep(key, action.stepId, action.headSha);
    case "step-done":
      return store.setStepDone(key, action.stepId, action.done);
    case "hotspot-checked":
      return store.setHotspotChecked(key, action.hotspotId, action.checked);
    case "note-add":
      store.addNote(key, action);
      return;
    case "note-delete":
      return store.deleteNote(key, action.id);
    case "pause":
      return store.pause(key, action.note);
    case "resume":
      return store.resume(key);
    case "jump-push":
      return store.pushJump(key, action);
    case "jump-pop":
      store.popJump(key);
      return;
    case "jump-clear":
      return store.clearJumps(key);
  }
}

export function applySessionAction(
  store: SessionStore,
  key: string,
  action: SessionAction,
): Session {
  apply(store, key, action);
  return store.getSession(key);
}
