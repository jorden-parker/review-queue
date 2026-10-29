import { z } from "zod";
import { llmConfigFromEnv } from "@/lib/llm/client";
import { autoModel, ollamaModels } from "@/lib/llm/model-choice";
import { jsonError } from "@/lib/http";
import type { SessionStore } from "@/lib/session/store";
import {
  type LlmSettings,
  LlmSettingsSchema,
  llmSettingsFromEnv,
  saveLlmSettings,
  savedLlmSettings,
} from "./llm-settings";

type Env = Record<string, string | undefined>;

export type SettingsView = { llm: LlmSettings; models: string[]; autoModel: string | null };

const SettingsUpdateSchema = z.object({ llm: LlmSettingsSchema });

function currentLlmSettings(store: SessionStore, env: Env): LlmSettings {
  return savedLlmSettings(store) ?? llmSettingsFromEnv(env);
}

export async function settingsView(
  store: SessionStore,
  env: Env = process.env,
  fetchImpl: typeof fetch = fetch,
): Promise<SettingsView> {
  const models = await ollamaModels(llmConfigFromEnv(env).baseURL, fetchImpl).catch(() => []);
  return {
    llm: currentLlmSettings(store, env),
    models,
    autoModel: await autoModel(env, models).catch(() => null),
  };
}

export async function updateSettings(
  store: SessionStore,
  body: unknown,
  env: Env = process.env,
  fetchImpl: typeof fetch = fetch,
): Promise<Response> {
  const update = SettingsUpdateSchema.safeParse(body);
  if (!update.success) return jsonError(update.error.message, 400);
  saveLlmSettings(store, update.data.llm);
  return Response.json(await settingsView(store, env, fetchImpl));
}

export function clearCacheResponse(store: SessionStore): Response {
  return Response.json({ cleared: store.clearCache() });
}
