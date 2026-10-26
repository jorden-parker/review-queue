import { type AssistAction, type LineRange, MAX_HISTORY_TURNS } from "@/lib/assist-protocol";
import type { Message } from "@/lib/llm/client";
import type { AssistRequest } from "@/lib/review/assist-request";

export type AssistTurn = { role: "reviewer" | "model"; text: string };

export type AssistThread = {
  range: LineRange;
  action: AssistAction;
  question: string | null;
  turns: AssistTurn[];
};

export const ACTION_LABELS: Record<AssistAction, string> = {
  explain: "Explain these lines",
  simplify: "Simplify these lines",
  comment: "Draft a review comment",
  ask: "Ask about these lines",
};

export const QUESTION_PROMPTS: Record<AssistAction, string | null> = {
  explain: null,
  simplify: null,
  comment: "What worries you about these lines?",
  ask: "What do you want to know?",
};

export function openThread(range: LineRange, action: AssistAction): AssistThread {
  const turns: AssistTurn[] =
    QUESTION_PROMPTS[action] === null ? [{ role: "reviewer", text: ACTION_LABELS[action] }] : [];
  return { range, action, question: null, turns };
}

export function awaitsQuestion(thread: AssistThread): boolean {
  return thread.turns.length === 0;
}

export function askedThread(thread: AssistThread, question: string): AssistThread {
  return { ...thread, question, turns: [{ role: "reviewer", text: question }] };
}

export function withFollowUp(thread: AssistThread, question: string): AssistThread {
  return { ...thread, turns: [...thread.turns, { role: "reviewer", text: question }] };
}

export function withModelText(thread: AssistThread, text: string): AssistThread {
  const last = thread.turns.at(-1);
  const earlier = last?.role === "model" ? thread.turns.slice(0, -1) : thread.turns;
  return { ...thread, turns: [...earlier, { role: "model", text }] };
}

export function canFollowUp(thread: AssistThread): boolean {
  return thread.turns.at(-1)?.role === "model" && thread.turns.length <= MAX_HISTORY_TURNS;
}

function asMessage(turn: AssistTurn): Message {
  return { role: turn.role === "model" ? "assistant" : "user", content: turn.text };
}

export function threadRequest(thread: AssistThread): AssistRequest {
  return {
    action: thread.action,
    path: thread.range.path,
    from: thread.range.from,
    to: thread.range.to,
    question: thread.question,
    history: thread.turns.slice(1).map(asMessage),
  };
}
