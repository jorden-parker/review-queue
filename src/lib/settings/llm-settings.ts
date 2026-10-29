import { z } from "zod";
import { llmConfigFromEnv } from "@/lib/llm/client";
import { parsedJson } from "@/lib/json";
import type { SessionStore } from "@/lib/session/store";

export const LlmSettingsSchema = z.object({
  enabled: z.boolean(),
  model: z.string().trim().min(1).max(200).nullable(),
  thinking: z.boolean(),
  timeoutMs: z.number().int().min(1_000).max(3_600_000),
});

export type LlmSettings = z.infer<typeof LlmSettingsSchema>;

type Env = Record<string, string | undefined>;

const SETTING_KEY = "llm";

export function llmSettingsFromEnv(env: Env): LlmSettings {
  const config = llmConfigFromEnv(env);
  return {
    enabled: config.enabled,
    model: env.REVIEW_QUEUE_LLM_MODEL ?? null,
    thinking: config.thinking,
    timeoutMs: config.timeoutMs,
  };
}

export function savedLlmSettings(store: SessionStore): LlmSettings | null {
  const raw = store.getSetting(SETTING_KEY);
  if (raw === null) return null;
  const parsed = LlmSettingsSchema.safeParse(parsedJson(raw));
  return parsed.success ? parsed.data : null;
}

export function saveLlmSettings(store: SessionStore, settings: LlmSettings): void {
  store.setSetting(SETTING_KEY, JSON.stringify(settings));
}
