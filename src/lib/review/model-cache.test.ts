import { describe, expect, it } from "vitest";
import { z } from "zod";
import { SessionStore } from "@/lib/session/store";
import { cachedModelResult } from "./model-cache";

const KEY = "model:test";
const SCHEMA = z.object({ value: z.string() });

function countingGenerator(value = "fresh") {
  let calls = 0;
  const generate = async () => {
    calls++;
    return { value };
  };
  return { generate, calls: () => calls };
}

describe("cachedModelResult", () => {
  it("generates on a miss and stores the result as JSON", async () => {
    const store = new SessionStore(":memory:");
    const { generate, calls } = countingGenerator();
    expect(await cachedModelResult(store, KEY, SCHEMA, generate)).toEqual({ value: "fresh" });
    expect(calls()).toBe(1);
    expect(JSON.parse(store.getCached(KEY) ?? "null")).toEqual({ value: "fresh" });
  });

  it("serves a valid cached row without generating", async () => {
    const store = new SessionStore(":memory:");
    store.setCached(KEY, JSON.stringify({ value: "stored" }));
    const { generate, calls } = countingGenerator();
    expect(await cachedModelResult(store, KEY, SCHEMA, generate)).toEqual({ value: "stored" });
    expect(calls()).toBe(0);
  });

  it("ignores a cached row that is not JSON and overwrites it", async () => {
    const store = new SessionStore(":memory:");
    store.setCached(KEY, "{oops");
    const { generate, calls } = countingGenerator();
    expect(await cachedModelResult(store, KEY, SCHEMA, generate)).toEqual({ value: "fresh" });
    expect(calls()).toBe(1);
    expect(JSON.parse(store.getCached(KEY) ?? "null")).toEqual({ value: "fresh" });
  });

  it("ignores a cached row that fails the schema and overwrites it", async () => {
    const store = new SessionStore(":memory:");
    store.setCached(KEY, '{"value":1}');
    const { generate, calls } = countingGenerator();
    expect(await cachedModelResult(store, KEY, SCHEMA, generate)).toEqual({ value: "fresh" });
    expect(calls()).toBe(1);
    expect(JSON.parse(store.getCached(KEY) ?? "null")).toEqual({ value: "fresh" });
  });

  it("shares one generation between concurrent callers", async () => {
    const store = new SessionStore(":memory:");
    const { generate, calls } = countingGenerator();
    const results = await Promise.all([
      cachedModelResult(store, KEY, SCHEMA, generate),
      cachedModelResult(store, KEY, SCHEMA, generate),
    ]);
    expect(results).toEqual([{ value: "fresh" }, { value: "fresh" }]);
    expect(calls()).toBe(1);
  });

  it("does not cache a failed generation", async () => {
    const store = new SessionStore(":memory:");
    const failing = async () => {
      throw new Error("model down");
    };
    await expect(cachedModelResult(store, KEY, SCHEMA, failing)).rejects.toThrow("model down");
    expect(store.getCached(KEY)).toBeNull();
    const { generate, calls } = countingGenerator();
    expect(await cachedModelResult(store, KEY, SCHEMA, generate)).toEqual({ value: "fresh" });
    expect(calls()).toBe(1);
  });
});
