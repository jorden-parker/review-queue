import { readFile, realpath } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
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

async function installedModels(baseURL: string, fetchImpl: typeof fetch): Promise<Set<string>> {
  const response = await fetchImpl(`${baseURL}/api/tags`, {
    signal: AbortSignal.timeout(TAGS_TIMEOUT_MS),
  });
  const tags = TagsSchema.parse(await response.json());
  return new Set(tags.models.map((model) => model.name.replace(/:latest$/, "")));
}

async function installedClaudeOllamaModel(
  env: Env,
  baseURL: string,
  fetchImpl: typeof fetch,
): Promise<string | null> {
  const [candidates, installed] = await Promise.all([
    claudeOllamaModels(env),
    installedModels(baseURL, fetchImpl),
  ]);
  return candidates.find((model) => installed.has(model)) ?? null;
}

export async function llmConfig(
  env: Env = process.env,
  fetchImpl: typeof fetch = fetch,
): Promise<LlmConfig> {
  const config = llmConfigFromEnv(env);
  if (env.REVIEW_QUEUE_LLM_MODEL || !config.enabled) return config;
  const model = await installedClaudeOllamaModel(env, config.baseURL, fetchImpl).catch(() => null);
  return model ? { ...config, model } : config;
}
