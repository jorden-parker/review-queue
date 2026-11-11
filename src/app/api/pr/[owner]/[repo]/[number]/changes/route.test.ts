import { describe, expect, it } from "vitest";
import type { PreparedReview } from "@/lib/review/prepare";

process.env.REVIEW_QUEUE_DB = ":memory:";

const KEY = "acme/app#7";
const BASELINE_SHA = "1".repeat(40);
const HEAD_SHA = "2".repeat(40);
const diffedFrom: string[] = [];
const review = {
  data: { pr: { ref: { owner: "acme", repo: "app", number: 7 } }, headSha: HEAD_SHA },
  diffFrom: async (sha: string) => {
    diffedFrom.push(sha);
    return [];
  },
} as unknown as PreparedReview;
const preparedReviews = new Map<string, Promise<PreparedReview>>();
preparedReviews.set(`${KEY}@${HEAD_SHA}`, Promise.resolve(review));
(globalThis as { reviewQueuePrepared?: unknown }).reviewQueuePrepared = preparedReviews;

const { GET } = await import("./route");
const { sessionStore } = await import("@/lib/review/services");

const context = { params: Promise.resolve({ owner: "acme", repo: "app", number: "7" }) };

function changesRequest(): Request {
  return new Request(`http://test/api?sha=${HEAD_SHA}`);
}

describe("changes route", () => {
  it("answers 404 until a push gives the session a baseline", async () => {
    expect((await GET(changesRequest(), context)).status).toBe(404);
    expect(diffedFrom).toEqual([]);
  });

  it("returns the diff from the baseline to the loaded head", async () => {
    sessionStore().markSeen(KEY, BASELINE_SHA);
    sessionStore().markSeen(KEY, HEAD_SHA);
    const response = await GET(changesRequest(), context);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      baselineHeadSha: BASELINE_SHA,
      headSha: HEAD_SHA,
      files: [],
    });
    expect(diffedFrom).toEqual([BASELINE_SHA]);
  });
});
