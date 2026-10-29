import type { z } from "zod";
import { parsedJson } from "@/lib/json";
import type { SessionStore } from "@/lib/session/store";

const inFlight = new Map<string, Promise<unknown>>();

export function storedModelResult<T>(
  store: SessionStore,
  key: string,
  schema: z.ZodType<T>,
): T | null {
  const raw = store.getCached(key);
  if (raw === null) return null;
  const parsed = schema.safeParse(parsedJson(raw));
  return parsed.success ? parsed.data : null;
}

function startGeneration<T>(
  store: SessionStore,
  key: string,
  generate: () => Promise<T>,
): Promise<T> {
  const pending = generate().then((value) => {
    store.setCached(key, JSON.stringify(value));
    return value;
  });
  const forget = () => inFlight.delete(key);
  pending.then(forget, forget);
  inFlight.set(key, pending);
  return pending;
}

export function cachedModelResult<T>(
  store: SessionStore,
  key: string,
  schema: z.ZodType<T>,
  generate: () => Promise<T>,
): Promise<T> {
  const cached = storedModelResult(store, key, schema);
  if (cached !== null) return Promise.resolve(cached);
  const existing = inFlight.get(key);
  if (existing) return existing as Promise<T>;
  return startGeneration(store, key, generate);
}
