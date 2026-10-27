import type { LlmConfig } from "@/lib/llm/client";
import {
  explainStep,
  StepExplanationRecordSchema,
  type StepExplanation,
} from "@/lib/llm/step-explanation";
import { prKey } from "@/lib/pr-ref";
import type { SessionStore } from "@/lib/session/store";
import { cachedModelResult, storedModelResult } from "./model-cache";
import type { ReviewData } from "./prepare";

export type ExplanationResult =
  | { status: "ready"; explanation: StepExplanation }
  | { status: "disabled" }
  | { status: "error"; message: string };

const EXPLANATION_CACHE_VERSION = 1;

function cacheKey(data: ReviewData, stepId: string, config: LlmConfig): string {
  return `explanation:v${EXPLANATION_CACHE_VERSION}:${prKey(data.pr.ref)}:${data.headSha}:${config.model}:${stepId}`;
}

export function storedExplanation(
  data: ReviewData,
  stepId: string,
  store: SessionStore,
  config: LlmConfig,
): StepExplanation | null {
  return storedModelResult(store, cacheKey(data, stepId, config), StepExplanationRecordSchema);
}

export async function explanationFor(
  data: ReviewData,
  stepId: string,
  store: SessionStore,
  config: LlmConfig,
  fetchImpl: typeof fetch = fetch,
): Promise<ExplanationResult> {
  if (!config.enabled) return { status: "disabled" };
  const step = data.steps.find((candidate) => candidate.id === stepId);
  if (!step) return { status: "error", message: "Unknown step" };
  try {
    const explanation = await cachedModelResult(
      store,
      cacheKey(data, stepId, config),
      StepExplanationRecordSchema,
      () => explainStep({ title: data.pr.title, step, diffs: data.files }, config, fetchImpl),
    );
    return { status: "ready", explanation };
  } catch (error) {
    return { status: "error", message: error instanceof Error ? error.message : String(error) };
  }
}
