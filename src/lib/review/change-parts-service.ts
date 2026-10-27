import type { LlmConfig } from "@/lib/llm/client";
import { ChangePartsRecordSchema, describeChanges, type ChangeParts } from "@/lib/llm/change-parts";
import { prKey } from "@/lib/pr-ref";
import type { SessionStore } from "@/lib/session/store";
import { cachedModelResult } from "./model-cache";
import type { ReviewData } from "./prepare";

export type ChangePartsResult =
  | { status: "ready"; parts: ChangeParts }
  | { status: "disabled" }
  | { status: "error"; message: string };

const CHANGE_PARTS_CACHE_VERSION = 1;

function cacheKey(data: ReviewData, config: LlmConfig): string {
  return `change-parts:v${CHANGE_PARTS_CACHE_VERSION}:${prKey(data.pr.ref)}:${data.headSha}:${config.model}`;
}

export async function changePartsFor(
  data: ReviewData,
  store: SessionStore,
  config: LlmConfig,
  fetchImpl: typeof fetch = fetch,
): Promise<ChangePartsResult> {
  if (!config.enabled) return { status: "disabled" };
  try {
    const parts = await cachedModelResult(
      store,
      cacheKey(data, config),
      ChangePartsRecordSchema,
      () =>
        describeChanges(
          { title: data.pr.title, map: data.changeMap, diffs: data.files },
          config,
          fetchImpl,
        ),
    );
    return { status: "ready", parts };
  } catch (error) {
    return { status: "error", message: error instanceof Error ? error.message : String(error) };
  }
}
