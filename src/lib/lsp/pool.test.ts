import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { LanguageClient } from "./client";
import { languageClients, stopAllLanguageClients } from "./pool";

function fakeClient() {
  return { stop: vi.fn(async () => {}) } as unknown as LanguageClient;
}

describe("languageClients", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(async () => {
    await stopAllLanguageClients();
    vi.useRealTimers();
    vi.unstubAllEnvs();
  });

  it("starts one client per checkout and language and reuses it", async () => {
    const start = vi.fn(async () => fakeClient());
    const clientFor = languageClients("/repo", () => "", start);
    const first = await clientFor("src/a.ts");
    expect(await clientFor("src/b.tsx")).toBe(first);
    expect(await clientFor("main.go")).not.toBe(first);
    expect(start).toHaveBeenCalledTimes(2);
  });

  it("returns null for unsupported files, failed starts and when disabled", async () => {
    const failing = languageClients(
      "/repo",
      () => "",
      async () => {
        throw new Error("ENOENT");
      },
    );
    expect(await failing("README.md")).toBeNull();
    expect(await failing("lib.rs")).toBeNull();
    vi.stubEnv("REVIEW_QUEUE_LSP", "off");
    const start = vi.fn(async () => fakeClient());
    expect(await languageClients("/other", () => "", start)("a.ts")).toBeNull();
    expect(start).not.toHaveBeenCalled();
  });

  it("stops a client after it sits idle", async () => {
    const client = fakeClient();
    const clientFor = languageClients(
      "/idle",
      () => "",
      async () => client,
    );
    await clientFor("a.ts");
    await vi.advanceTimersByTimeAsync(11 * 60 * 1000);
    expect(client.stop).toHaveBeenCalled();
  });
});
