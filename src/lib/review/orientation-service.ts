import type { LlmConfig } from "@/lib/llm/client";
import {
  orient,
  OrientationRecordSchema,
  type Orientation,
  type OrientationInput,
} from "@/lib/llm/orientation";
import { prKey } from "@/lib/pr-ref";
import type { SessionStore } from "@/lib/session/store";
import { cachedModelResult } from "./model-cache";
import type { ReviewData } from "./prepare";

export type OrientationResult =
  | { status: "ready"; orientation: Orientation }
  | { status: "disabled" }
  | { status: "error"; message: string };

const ORIENTATION_CACHE_VERSION = 3;

function cacheKey(data: ReviewData, config: LlmConfig): string {
  return `orientation:v${ORIENTATION_CACHE_VERSION}:${prKey(data.pr.ref)}:${data.headSha}:${config.model}`;
}

function orientationInput(data: ReviewData): OrientationInput {
  return {
    title: data.pr.title,
    body: data.pr.body,
    diffs: data.files,
    steps: data.steps,
    hotspots: data.hotspots,
  };
}

export async function orientationFor(
  data: ReviewData,
  store: SessionStore,
  config: LlmConfig,
  fetchImpl: typeof fetch = fetch,
): Promise<OrientationResult> {
  if (!config.enabled) return { status: "disabled" };
  try {
    const orientation = await cachedModelResult(
      store,
      cacheKey(data, config),
      OrientationRecordSchema,
      () => orient(orientationInput(data), config, fetchImpl),
    );
    return { status: "ready", orientation };
  } catch (error) {
    return { status: "error", message: error instanceof Error ? error.message : String(error) };
  }
}
