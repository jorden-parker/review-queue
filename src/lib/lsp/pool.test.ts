import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { LanguageClient } from "./client";
import { languageClients, stopAllLanguageClients } from "./pool";

function fakeClient() {
  const listeners: (() => void)[] = [];
  return {
    stop: vi.fn(async () => {}),
    onClose: (listener: () => void) => listeners.push(listener),
    closeConnection: () => listeners.forEach((listener) => listener()),
  } as unknown as LanguageClient & { closeConnection: () => void };
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

  it("forgets a failed start so the next request tries again", async () => {
    let attempts = 0;
    const start = vi.fn(async () => {
      attempts += 1;
      if (attempts === 1) throw new Error("initialize timed out");
      return fakeClient();
    });
    const clientFor = languageClients("/retry", () => "", start);
    expect(await clientFor("src/a.ts")).toBeNull();
    expect(await clientFor("src/a.ts")).not.toBeNull();
    expect(start).toHaveBeenCalledTimes(2);
  });

  it("forgets a client whose connection closed so the next request starts a new one", async () => {
    const first = fakeClient();
    const start = vi.fn(async () => first);
    const clientFor = languageClients("/closed", () => "", start);
    expect(await clientFor("src/a.ts")).toBe(first);
    first.closeConnection();
    start.mockResolvedValueOnce(fakeClient());
    expect(await clientFor("src/a.ts")).not.toBe(first);
    expect(start).toHaveBeenCalledTimes(2);
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
