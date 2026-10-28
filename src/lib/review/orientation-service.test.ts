import { describe, expect, it } from "vitest";
import type { PullRequest } from "@/lib/github/gh";
import { SessionStore } from "@/lib/session/store";
import { orientationFor, storedOrientation } from "./orientation-service";
import type { ReviewData } from "./prepare";
import { modelReply } from "@/test/fake-llm";

const DATA: ReviewData = {
  pr: { ref: { owner: "a", repo: "b", number: 1 }, title: "T", body: "" } as PullRequest,
  headSha: "sha",
  files: [],
  steps: [],
  startStepId: null,
  hotspots: [],
  estimateMinutes: 1,
  changeMap: { nodes: [], edges: [], threads: [], orphanIds: [] },
};
const CONFIG = {
  baseURL: "http://llm.test",
  model: "m",
  enabled: true,
  thinking: true,
  timeoutMs: 1000,
};
const REPLY = {
  summary: "S",
  intent: "I",
  risk: "low",
  stepOrder: [],
  hotspotNotes: [],
  extraHotspots: [],
};

function countingFetch() {
  let calls = 0;
  const fetchImpl = (async () => {
    calls++;
    return modelReply(JSON.stringify(REPLY));
  }) as unknown as typeof fetch;
  return { fetchImpl, calls: () => calls };
}

describe("orientationFor", () => {
  it("is disabled when the LLM is switched off", async () => {
    const store = new SessionStore(":memory:");
    expect(await orientationFor(DATA, store, { ...CONFIG, enabled: false })).toEqual({
      status: "disabled",
    });
  });

  it("asks once, then serves from the cache", async () => {
    const store = new SessionStore(":memory:");
    const { fetchImpl, calls } = countingFetch();
    const first = await orientationFor(DATA, store, CONFIG, fetchImpl);
    const second = await orientationFor(DATA, store, CONFIG, fetchImpl);
    expect(first).toMatchObject({ status: "ready", orientation: { summary: "S" } });
    expect(second).toEqual(first);
    expect(calls()).toBe(1);
  });

  it("ignores a cached orientation that no longer matches the schema", async () => {
    const store = new SessionStore(":memory:");
    store.setCached("orientation:v2:a/b#1:sha:m", JSON.stringify({ summary: 1 }));
    const { fetchImpl, calls } = countingFetch();
    expect(await orientationFor(DATA, store, CONFIG, fetchImpl)).toMatchObject({
      status: "ready",
      orientation: { summary: "S" },
    });
    expect(calls()).toBe(1);
  });

  it("reports errors without throwing", async () => {
    const store = new SessionStore(":memory:");
    const failing = (async () => new Response("down", { status: 503 })) as unknown as typeof fetch;
    expect(await orientationFor(DATA, store, CONFIG, failing)).toMatchObject({ status: "error" });
  });
});

describe("storedOrientation", () => {
  it("is null until the orientation has been generated", () => {
    const store = new SessionStore(":memory:");
    expect(storedOrientation(DATA, store, CONFIG)).toBeNull();
  });

  it("returns the cached orientation without asking again", async () => {
    const store = new SessionStore(":memory:");
    const { fetchImpl, calls } = countingFetch();
    await orientationFor(DATA, store, CONFIG, fetchImpl);
    expect(storedOrientation(DATA, store, CONFIG)).toMatchObject({ summary: "S" });
    expect(calls()).toBe(1);
  });
});
