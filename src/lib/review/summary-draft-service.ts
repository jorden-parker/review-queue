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
): Promise<SummaryDraftResult> {
  if (!config.enabled) return { status: "disabled" };
  try {
    const summary = await draftSummary({ title, event, notes }, config, fetchImpl);
    return { status: "ready", summary };
  } catch (error) {
    return { status: "error", message: error instanceof Error ? error.message : String(error) };
  }
}
