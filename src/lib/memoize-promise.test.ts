import { describe, expect, it, vi } from "vitest";
import { memoizePromise } from "./memoize-promise";

describe("memoizePromise", () => {
  it("shares one pending load between callers", () => {
    const cache = new Map<string, Promise<string>>();
    const make = vi.fn(async () => "value");
    expect(memoizePromise(cache, "k", make)).toBe(memoizePromise(cache, "k", make));
    expect(make).toHaveBeenCalledTimes(1);
  });

  it("keeps a successful load without loading again", async () => {
    const cache = new Map<string, Promise<string>>();
    const make = vi.fn(async () => "value");
    await memoizePromise(cache, "k", make);
    await expect(memoizePromise(cache, "k", make)).resolves.toBe("value");
    expect(make).toHaveBeenCalledTimes(1);
  });

  it("forgets a failed load so the next call retries", async () => {
    const cache = new Map<string, Promise<string>>();
    const make = vi
      .fn<() => Promise<string>>()
      .mockRejectedValueOnce(new Error("down"))
      .mockResolvedValueOnce("value");
    await expect(memoizePromise(cache, "k", make)).rejects.toThrow("down");
    await expect(memoizePromise(cache, "k", make)).resolves.toBe("value");
    expect(make).toHaveBeenCalledTimes(2);
  });

  it("does not let a stale rejection remove a newer load", async () => {
    const cache = new Map<string, Promise<string>>();
    let rejectStale: (error: Error) => void = () => undefined;
    const stale = memoizePromise(
      cache,
      "k",
      () =>
        new Promise<string>((_, reject) => {
          rejectStale = reject;
        }),
    );
    cache.delete("k");
    const fresh = memoizePromise(cache, "k", async () => "fresh");
    rejectStale(new Error("late"));
    await expect(stale).rejects.toThrow("late");
    expect(cache.get("k")).toBe(fresh);
    await expect(fresh).resolves.toBe("fresh");
  });
});
