import { describe, expect, it } from "vitest";
import { TtlCache } from "./ttl-cache";

function fakeClock() {
  let time = 0;
  return { now: () => time, advance: (ms: number) => (time += ms) };
}

function countingLoader<T>(value: T) {
  let loads = 0;
  const load = async () => {
    loads++;
    return value;
  };
  return { load, loads: () => loads };
}

describe("TtlCache", () => {
  it("shares one load between concurrent callers", async () => {
    const cache = new TtlCache(fakeClock().now);
    const loader = countingLoader("pr");
    const results = await Promise.all([
      cache.get("a", 1000, loader.load),
      cache.get("a", 1000, loader.load),
    ]);
    expect(results).toEqual(["pr", "pr"]);
    expect(loader.loads()).toBe(1);
  });

  it("reloads once the entry expires", async () => {
    const clock = fakeClock();
    const cache = new TtlCache(clock.now);
    const loader = countingLoader("pr");
    await cache.get("a", 1000, loader.load);
    clock.advance(999);
    await cache.get("a", 1000, loader.load);
    expect(loader.loads()).toBe(1);
    clock.advance(1);
    await cache.get("a", 1000, loader.load);
    expect(loader.loads()).toBe(2);
  });

  it("keeps keys apart", async () => {
    const cache = new TtlCache(fakeClock().now);
    await cache.get("a", 1000, async () => "first");
    expect(await cache.get("b", 1000, async () => "second")).toBe("second");
  });

  it("does not cache failures", async () => {
    const cache = new TtlCache(fakeClock().now);
    await expect(
      cache.get("a", 1000, async () => {
        throw new Error("boom");
      }),
    ).rejects.toThrow("boom");
    expect(await cache.get("a", 1000, async () => "recovered")).toBe("recovered");
  });
});
