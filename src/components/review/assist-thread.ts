import {
  type AssistAction,
  type AssistTarget,
  type AssistThread,
  type AssistTurn,
  MAX_HISTORY_TURNS,
} from "@/lib/assist-protocol";
import type { Message } from "@/lib/llm/client";
import type { AssistRequest } from "@/lib/review/assist-request";

function subject(target: AssistTarget): string {
  return target.kind === "file" ? "this file" : "these lines";
}

export function actionLabel(action: AssistAction, target: AssistTarget): string {
  const labels: Record<AssistAction, string> = {
    explain: `Explain ${subject(target)}`,
    simplify: `Simplify ${subject(target)}`,
    comment: "Draft a review comment",
    ask: `Ask about ${subject(target)}`,
    check: `Check the flag on ${subject(target)}`,
  };
  return labels[action];
}

export function questionPrompt(action: AssistAction, target: AssistTarget): string | null {
  const prompts: Record<AssistAction, string | null> = {
    explain: null,
    simplify: null,
    comment: `What worries you about ${subject(target)}?`,
    ask: "What do you want to know?",
    check: null,
  };
  return prompts[action];
}

export function openThread(
  target: AssistTarget,
  action: AssistAction,
  headSha: string,
): AssistThread {
  const turns: AssistTurn[] =
    questionPrompt(action, target) === null
      ? [{ role: "reviewer", text: actionLabel(action, target) }]
      : [];
  return { id: crypto.randomUUID(), headSha, target, action, question: null, turns };
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

export function hasModelReply(thread: AssistThread): boolean {
  const last = thread.turns.at(-1);
  return last?.role === "model" && last.text.trim() !== "";
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
    target: thread.target,
    question: thread.question,
    history: thread.turns.slice(1).map(asMessage),
  };
}
