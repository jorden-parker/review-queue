import { LanguageClient, type ReadSource } from "./client";
import { serverFor, type LanguageServer } from "./servers";

export type ClientFor = (file: string) => Promise<LanguageClient | null>;

type StartClient = (
  server: LanguageServer,
  root: string,
  readSource: ReadSource,
) => Promise<LanguageClient>;

type Entry = { client: Promise<LanguageClient | null>; timer: NodeJS.Timeout };

const IDLE_MS = 10 * 60 * 1000;
const globals = globalThis as { reviewQueueLanguageClients?: Map<string, Entry> };
const entries = (globals.reviewQueueLanguageClients ??= new Map());

function lspEnabled(): boolean {
  return process.env.REVIEW_QUEUE_LSP !== "off";
}

async function stopEntry(key: string): Promise<void> {
  const entry = entries.get(key);
  if (!entry) return;
  entries.delete(key);
  clearTimeout(entry.timer);
  await (await entry.client)?.stop();
}

function idleTimer(key: string): NodeJS.Timeout {
  const timer = setTimeout(() => void stopEntry(key), IDLE_MS);
  timer.unref?.();
  return timer;
}

function touch(key: string, entry: Entry): void {
  clearTimeout(entry.timer);
  entry.timer = idleTimer(key);
}

export function languageClients(
  root: string,
  readSource: ReadSource,
  start: StartClient = LanguageClient.start,
): ClientFor {
  return async (file) => {
    const server = serverFor(file);
    if (!server || !lspEnabled()) return null;
    const key = `${root}\0${server.id}`;
    const existing = entries.get(key);
    if (existing) {
      touch(key, existing);
      return existing.client;
    }
    const client = start(server, root, readSource).catch(() => null);
    entries.set(key, { client, timer: idleTimer(key) });
    return client;
  };
}

export async function stopAllLanguageClients(): Promise<void> {
  await Promise.all([...entries.keys()].map(stopEntry));
}
