import { z } from "zod";
import {
  ASSIST_ACTIONS,
  isBefore,
  type LinePosition,
  linesInRange,
  MAX_HISTORY_TURNS,
} from "@/lib/assist-protocol";
import type { AssistInput } from "@/lib/llm/assist";
import type { Message } from "@/lib/llm/client";
import type { Hunk } from "@/lib/types";
import type { ReviewData } from "./prepare";

const PositionSchema = z.object({
  hunk: z.number().int().nonnegative(),
  line: z.number().int().nonnegative(),
});

const MessageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().min(1).max(8_000),
});

function alternatesFromModel(history: Message[]): boolean {
  return history.every(
    (message, index) => message.role === (index % 2 === 0 ? "assistant" : "user"),
  );
}

const HistorySchema = z
  .array(MessageSchema)
  .max(MAX_HISTORY_TURNS)
  .refine(
    (history) => history.length % 2 === 0 && alternatesFromModel(history),
    "History must alternate model and reviewer turns, ending with the reviewer",
  );

export const AssistRequestSchema = z.object({
  action: z.enum(ASSIST_ACTIONS),
  path: z.string().min(1),
  from: PositionSchema,
  to: PositionSchema,
  question: z.string().trim().min(1).max(2_000).nullable(),
  history: HistorySchema,
});

export type AssistRequest = z.infer<typeof AssistRequestSchema>;

type AssistInputResult = { ok: true; input: AssistInput } | { ok: false; error: string };

function hasLine(hunks: Hunk[], position: LinePosition): boolean {
  return position.line < (hunks[position.hunk]?.lines.length ?? 0);
}

export function assistInputFrom(data: ReviewData, request: AssistRequest): AssistInputResult {
  const file = data.files.find((candidate) => candidate.path === request.path);
  if (!file) return { ok: false, error: "That file is not in this review" };
  const { from, to } = request;
  if (!hasLine(file.hunks, from) || !hasLine(file.hunks, to) || isBefore(to, from))
    return { ok: false, error: "Those lines are not in this diff" };
  return {
    ok: true,
    input: {
      title: data.pr.title,
      path: file.path,
      context: file.hunks.slice(from.hunk, to.hunk + 1),
      selected: linesInRange(file.hunks, from, to),
      action: request.action,
      question: request.question,
    },
  };
}
