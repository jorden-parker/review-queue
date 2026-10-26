import { readFile, realpath } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { type LlmSettings, llmSettingsFromEnv } from "@/lib/settings/llm-settings";
import { llmConfigFromEnv, type LlmConfig } from "./client";

type Env = Record<string, string | undefined>;

const TAGS_TIMEOUT_MS = 5_000;
const SizesSchema = z.record(z.string(), z.object({ model: z.string() }));
const TagsSchema = z.object({ models: z.array(z.object({ name: z.string() })) });

export async function claudeOllamaSizesPath(env: Env): Promise<string | null> {
  for (const dir of (env.PATH ?? "").split(path.delimiter).filter(Boolean)) {
    const launcher = await realpath(path.join(dir, "claude-ollama")).catch(() => null);
    if (launcher) return path.join(path.dirname(launcher), "..", "ollama", "sizes.json");
  }
  return null;
}

async function claudeOllamaModels(env: Env): Promise<string[]> {
  const sizesPath = await claudeOllamaSizesPath(env);
  if (!sizesPath) return [];
  const sizes = SizesSchema.parse(JSON.parse(await readFile(sizesPath, "utf8")));
  return Object.values(sizes).map((size) => size.model);
}

export async function ollamaModels(baseURL: string, fetchImpl: typeof fetch): Promise<string[]> {
  const response = await fetchImpl(`${baseURL}/api/tags`, {
    signal: AbortSignal.timeout(TAGS_TIMEOUT_MS),
  });
  const tags = TagsSchema.parse(await response.json());
  return tags.models.map((model) => model.name.replace(/:latest$/, ""));
}

export async function autoModel(env: Env, installed: string[]): Promise<string | null> {
  const candidates = await claudeOllamaModels(env);
  return candidates.find((model) => installed.includes(model)) ?? null;
}

async function installedAutoModel(
  env: Env,
  baseURL: string,
  fetchImpl: typeof fetch,
): Promise<string | null> {
  return autoModel(env, await ollamaModels(baseURL, fetchImpl));
}

export async function llmConfig(
  env: Env = process.env,
  fetchImpl: typeof fetch = fetch,
  saved: LlmSettings | null = null,
): Promise<LlmConfig> {
  const settings = saved ?? llmSettingsFromEnv(env);
  const { model, ...choices } = settings;
  const config = { ...llmConfigFromEnv(env), ...choices };
  if (model) return { ...config, model };
  if (!config.enabled) return config;
  const chosen = await installedAutoModel(env, config.baseURL, fetchImpl).catch(() => null);
  return chosen ? { ...config, model: chosen } : config;
}
