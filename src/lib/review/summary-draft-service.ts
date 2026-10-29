import { logServerError } from "@/lib/log";
import type { ReviewEvent } from "@/lib/github/gh";
import { draftSummary } from "@/lib/llm/summary-draft";
import type { LlmConfig } from "@/lib/llm/client";
import type { Note } from "@/lib/types";

export type SummaryDraftResult =
  | { status: "ready"; summary: string }
  | { status: "disabled" }
  | { status: "error"; message: string };

export async function summaryDraftFor(
  title: string,
  event: ReviewEvent,
  notes: Note[],
  config: LlmConfig,
  fetchImpl: typeof fetch = fetch,
  signal?: AbortSignal,
): Promise<SummaryDraftResult> {
  if (!config.enabled) return { status: "disabled" };
  try {
    const summary = await draftSummary({ title, event, notes }, config, fetchImpl, signal);
    return { status: "ready", summary };
  } catch (error) {
    logServerError("summary draft", error);
    return { status: "error", message: error instanceof Error ? error.message : String(error) };
  }
}
