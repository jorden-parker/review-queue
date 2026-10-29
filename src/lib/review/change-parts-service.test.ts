import { describe, expect, it, vi } from "vitest";
import type { PullRequest } from "@/lib/github/gh";
import { SessionStore } from "@/lib/session/store";
import { changePartsFor } from "./change-parts-service";
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
  changeMap: {
    nodes: [
      {
        id: "a.ts#save",
        path: "a.ts",
        name: "save",
        kind: "function",
        role: "core",
        line: 1,
        hunkIndexes: [0],
        stepId: null,
      },
    ],
    edges: [],
    threads: [{ id: "a.ts#save", entryId: "a.ts#save", nodeIds: ["a.ts#save"], testIds: [] }],
    orphanIds: [],
  },
};
const CONFIG = {
  baseURL: "http://llm.test",
  model: "m",
  enabled: true,
  thinking: false,
  timeoutMs: 1000,
};
const REPLY = { parts: [{ id: "c1", part: "Persists the setting.", weight: "essential" }] };

function countingFetch() {
  let calls = 0;
  const fetchImpl = (async () => {
    calls++;
    return modelReply(JSON.stringify(REPLY));
  }) as unknown as typeof fetch;
  return { fetchImpl, calls: () => calls };
}

describe("changePartsFor", () => {
  it("is disabled when the LLM is switched off", async () => {
    const store = new SessionStore(":memory:");
    expect(await changePartsFor(DATA, store, { ...CONFIG, enabled: false })).toEqual({
      status: "disabled",
    });
  });

  it("asks once, then serves from the cache", async () => {
    const store = new SessionStore(":memory:");
    const { fetchImpl, calls } = countingFetch();
    const first = await changePartsFor(DATA, store, CONFIG, fetchImpl);
    const second = await changePartsFor(DATA, store, CONFIG, fetchImpl);
    expect(first).toMatchObject({ status: "ready", parts: { parts: [{ id: "a.ts#save" }] } });
    expect(second).toEqual(first);
    expect(calls()).toBe(1);
  });

  it("reports errors without throwing", async () => {
    const store = new SessionStore(":memory:");
    const failing = (async () => new Response("down", { status: 503 })) as unknown as typeof fetch;
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await changePartsFor(DATA, store, CONFIG, failing)).toMatchObject({
      status: "error",
    });
    expect(logged).toHaveBeenCalledOnce();
    expect(logged.mock.calls[0][0]).toContain("review-queue: change parts a/b#1 failed");
    logged.mockRestore();
  });
});
