import { describe, expect, it } from "vitest";
import type { PullRequest } from "@/lib/github/gh";
import { SessionStore } from "@/lib/session/store";
import { explanationFor, storedExplanation } from "./explanation-service";
import type { ReviewData } from "./prepare";

const STEP = {
  id: "core:src/a.ts:0",
  title: "a.ts",
  role: "core" as const,
  reason: "Holds the cache.",
  changedLines: 1,
  files: [{ path: "src/a.ts", hunkIndexes: [] }],
};
const DATA: ReviewData = {
  pr: { ref: { owner: "a", repo: "b", number: 1 }, title: "T", body: "" } as PullRequest,
  headSha: "sha",
  files: [],
  steps: [STEP],
  startStepId: null,
  hotspots: [],
  estimateMinutes: 1,
};
const CONFIG = {
  baseURL: "http://llm.test",
  model: "m",
  enabled: true,
  thinking: true,
  timeoutMs: 1000,
};
const REPLY = { what: "Adds a cache.", checks: ["Is the key stable?"] };

function countingFetch() {
  let calls = 0;
  const fetchImpl = (async () => {
    calls++;
    return Response.json({ content: [{ type: "text", text: JSON.stringify(REPLY) }] });
  }) as unknown as typeof fetch;
  return { fetchImpl, calls: () => calls };
}

describe("explanationFor", () => {
  it("is disabled when the LLM is switched off", async () => {
    const store = new SessionStore(":memory:");
    expect(await explanationFor(DATA, STEP.id, store, { ...CONFIG, enabled: false })).toEqual({
      status: "disabled",
    });
  });

  it("reports an unknown step without asking the model", async () => {
    const store = new SessionStore(":memory:");
    const { fetchImpl, calls } = countingFetch();
    expect(await explanationFor(DATA, "nope", store, CONFIG, fetchImpl)).toEqual({
      status: "error",
      message: "Unknown step",
    });
    expect(calls()).toBe(0);
  });

  it("asks once, then serves from the cache", async () => {
    const store = new SessionStore(":memory:");
    const { fetchImpl, calls } = countingFetch();
    const first = await explanationFor(DATA, STEP.id, store, CONFIG, fetchImpl);
    const second = await explanationFor(DATA, STEP.id, store, CONFIG, fetchImpl);
    expect(first).toMatchObject({ status: "ready", explanation: { what: "Adds a cache." } });
    expect(second).toEqual(first);
    expect(calls()).toBe(1);
  });

  it("reports errors without throwing", async () => {
    const store = new SessionStore(":memory:");
    const failing = (async () => new Response("down", { status: 503 })) as unknown as typeof fetch;
    expect(await explanationFor(DATA, STEP.id, store, CONFIG, failing)).toMatchObject({
      status: "error",
    });
  });
});

describe("storedExplanation", () => {
  it("is null until the explanation has been generated", async () => {
    const store = new SessionStore(":memory:");
    expect(storedExplanation(DATA, STEP.id, store, CONFIG)).toBeNull();
  });

  it("returns the explanation the model wrote, without asking again", async () => {
    const store = new SessionStore(":memory:");
    const { fetchImpl, calls } = countingFetch();
    const generated = await explanationFor(DATA, STEP.id, store, CONFIG, fetchImpl);
    expect(storedExplanation(DATA, STEP.id, store, CONFIG)).toEqual(
      generated.status === "ready" ? generated.explanation : null,
    );
    expect(calls()).toBe(1);
  });

  it("is null for a different model", async () => {
    const store = new SessionStore(":memory:");
    const { fetchImpl } = countingFetch();
    await explanationFor(DATA, STEP.id, store, CONFIG, fetchImpl);
    expect(storedExplanation(DATA, STEP.id, store, { ...CONFIG, model: "other" })).toBeNull();
  });
});
