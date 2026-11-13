import { z } from "zod";
import { parsedJson } from "@/lib/json";
import type { SessionStore } from "@/lib/session/store";

export const REPOSITORY_LIMIT = 20;

export const RepositoriesSchema = z
  .array(
    z
      .string()
      .trim()
      .regex(/^[\w.-]+\/[\w.-]+$/),
  )
  .max(REPOSITORY_LIMIT);

const SETTING_KEY = "repositories";

export function savedRepositories(store: SessionStore): string[] {
  const raw = store.getSetting(SETTING_KEY);
  if (raw === null) return [];
  const parsed = RepositoriesSchema.safeParse(parsedJson(raw));
  return parsed.success ? parsed.data : [];
}

export function saveRepositories(store: SessionStore, repositories: string[]): void {
  store.setSetting(SETTING_KEY, JSON.stringify(repositories));
}
