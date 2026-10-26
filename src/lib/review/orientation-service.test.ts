import { describe, expect, it } from "vitest";
import type { PullRequest } from "@/lib/github/gh";
import { SessionStore } from "@/lib/session/store";
import { orientationFor } from "./orientation-service";
import type { ReviewData } from "./prepare";

const DATA: ReviewData = {
  pr: { ref: { owner: "a", repo: "b", number: 1 }, title: "T", body: "" } as PullRequest,
  headSha: "sha",
  files: [],
  steps: [],
  startStepId: null,
  hotspots: [],
  linkableNames: [],
  estimateMinutes: 1,
};
const CONFIG = { baseURL: "http://llm.test", model: "m", enabled: true, timeoutMs: 1000 };
const REPLY = {
  summary: "S",
  intent: "I",
  risk: "low",
  startStepId: "",
  startReason: "R",
  hotspotNotes: [],
  extraHotspots: [],
};

function countingFetch() {
  let calls = 0;
  const fetchImpl = (async () => {
    calls++;
    return Response.json({ content: [{ type: "text", text: JSON.stringify(REPLY) }] });
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

  it("reports errors without throwing", async () => {
    const store = new SessionStore(":memory:");
    const failing = (async () => new Response("down", { status: 503 })) as unknown as typeof fetch;
    expect(await orientationFor(DATA, store, CONFIG, failing)).toMatchObject({ status: "error" });
  });
});
