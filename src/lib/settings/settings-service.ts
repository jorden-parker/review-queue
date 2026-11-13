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
import { RepositoriesSchema, saveRepositories, savedRepositories } from "./repository-settings";

type Env = Record<string, string | undefined>;

export type SettingsView = {
  llm: LlmSettings;
  models: string[];
  autoModel: string | null;
  repositories: string[];
};

const SettingsUpdateSchema = z.object({
  llm: LlmSettingsSchema.optional(),
  repositories: RepositoriesSchema.optional(),
});

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
    repositories: savedRepositories(store),
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
  if (update.data.llm) saveLlmSettings(store, update.data.llm);
  if (update.data.repositories) saveRepositories(store, update.data.repositories);
  return Response.json(await settingsView(store, env, fetchImpl));
}

export function clearCacheResponse(store: SessionStore): Response {
  return Response.json({ cleared: store.clearCache() });
}
