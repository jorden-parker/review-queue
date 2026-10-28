import { describe, expect, it } from "vitest";
import type { PreparedReview } from "@/lib/review/prepare";

process.env.REVIEW_QUEUE_DB = ":memory:";

const LOADED_SHA = "abc123";
const preparedReviews = new Map<string, Promise<Partial<PreparedReview>>>();
preparedReviews.set(
  `acme/app#7@${LOADED_SHA}`,
  Promise.resolve({
    index: { listFiles: async () => ["a.ts", "docs/readme.md"] } as PreparedReview["index"],
  }),
);
(globalThis as { reviewQueuePrepared?: unknown }).reviewQueuePrepared = preparedReviews;

const { GET } = await import("./route");

function context(number = "7") {
  return { params: Promise.resolve({ owner: "acme", repo: "app", number }) };
}

function request(sha: string) {
  return new Request(`http://test/api/files?sha=${sha}`);
}

describe("GET files", () => {
  it("asks for a reload when that commit is not loaded", async () => {
    expect((await GET(request("unknown"), context())).status).toBe(409);
  });

  it("lists every tracked path of a loaded commit", async () => {
    const response = await GET(request(LOADED_SHA), context());
    expect(await response.json()).toEqual({ paths: ["a.ts", "docs/readme.md"] });
  });
});
