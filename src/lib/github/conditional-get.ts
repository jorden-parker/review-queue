import type { Runner } from "@/lib/exec";
import type { SessionStore } from "@/lib/session/store";
import { githubRun } from "./github-guard";

export type EtagCache = Pick<SessionStore, "getCached" | "setCached">;

type CachedResponse = { etag: string; body: string };

const HEADER_BODY_SEPARATOR = /\r?\n\r?\n/;
const ETAG_HEADER = /^etag:\s*(.+?)\s*$/im;
const NOT_MODIFIED = /HTTP 304/;

function cacheKey(path: string): string {
  return `etag:${path}`;
}

function readCached(cache: EtagCache, path: string): CachedResponse | null {
  const raw = cache.getCached(cacheKey(path));
  return raw ? (JSON.parse(raw) as CachedResponse) : null;
}

function splitResponse(output: string): { headers: string; body: string } {
  const match = HEADER_BODY_SEPARATOR.exec(output);
  if (!match) return { headers: output, body: "" };
  return {
    headers: output.slice(0, match.index),
    body: output.slice(match.index + match[0].length),
  };
}

function isNotModified(error: unknown): boolean {
  return error instanceof Error && NOT_MODIFIED.test(error.message);
}

export async function conditionalGet(
  path: string,
  cache: EtagCache,
  run: Runner = githubRun,
): Promise<string> {
  const cached = readCached(cache, path);
  const validator = cached ? ["-H", `If-None-Match: ${cached.etag}`] : [];
  try {
    const { headers, body } = splitResponse(await run("gh", ["api", "-i", path, ...validator]));
    const etag = ETAG_HEADER.exec(headers)?.[1];
    if (etag) cache.setCached(cacheKey(path), JSON.stringify({ etag, body }));
    return body;
  } catch (error) {
    if (cached && isNotModified(error)) return cached.body;
    throw error;
  }
}
