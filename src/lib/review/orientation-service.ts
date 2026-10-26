import { orient, type LlmConfig, type Orientation } from "@/lib/llm/orientation";
import { prKey } from "@/lib/pr-ref";
import type { SessionStore } from "@/lib/session/store";
import type { ReviewData } from "./prepare";

export type OrientationResult =
  | { status: "ready"; orientation: Orientation }
  | { status: "disabled" }
  | { status: "error"; message: string };

const inFlight = new Map<string, Promise<OrientationResult>>();

function cacheKey(data: ReviewData, config: LlmConfig): string {
  return `orientation:${prKey(data.pr.ref)}:${data.headSha}:${config.model}`;
}

async function generate(
  data: ReviewData,
  store: SessionStore,
  config: LlmConfig,
  key: string,
  fetchImpl: typeof fetch,
): Promise<OrientationResult> {
  try {
    const orientation = await orient(
      {
        title: data.pr.title,
        body: data.pr.body,
        diffs: data.files,
        steps: data.steps,
        hotspots: data.hotspots,
      },
      config,
      fetchImpl,
    );
    store.setCached(key, JSON.stringify(orientation));
    return { status: "ready", orientation };
  } catch (error) {
    return { status: "error", message: error instanceof Error ? error.message : String(error) };
  }
}

export function orientationFor(
  data: ReviewData,
  store: SessionStore,
  config: LlmConfig,
  fetchImpl: typeof fetch = fetch,
): Promise<OrientationResult> {
  if (!config.enabled) return Promise.resolve({ status: "disabled" });
  const key = cacheKey(data, config);
  const cached = store.getCached(key);
  if (cached) return Promise.resolve({ status: "ready", orientation: JSON.parse(cached) });
  if (!inFlight.has(key)) {
    const pending = generate(data, store, config, key, fetchImpl);
    pending.finally(() => inFlight.delete(key));
    inFlight.set(key, pending);
  }
  return inFlight.get(key)!;
}
