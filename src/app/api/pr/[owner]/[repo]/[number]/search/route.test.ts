import { describe, expect, it } from "vitest";
import type { PreparedReview } from "@/lib/review/prepare";

process.env.REVIEW_QUEUE_DB = ":memory:";

const LOADED_SHA = "abc123";
const MATCH = { path: "docs/errors.md", line: 1, text: "Request failed: E_PAYLOAD_TOO_LARGE" };
const preparedReviews = new Map<string, Promise<Partial<PreparedReview>>>();
preparedReviews.set(
  `acme/app#7@${LOADED_SHA}`,
  Promise.resolve({
    index: { search: async () => [MATCH] } as unknown as PreparedReview["index"],
  }),
);
(globalThis as { reviewQueuePrepared?: unknown }).reviewQueuePrepared = preparedReviews;

const { GET } = await import("./route");

function context(number = "7") {
  return { params: Promise.resolve({ owner: "acme", repo: "app", number }) };
}

function request(sha: string, query: string) {
  return new Request(`http://test/api/search?sha=${sha}&q=${encodeURIComponent(query)}`);
}

describe("GET search", () => {
  it("asks for a reload when that commit is not loaded", async () => {
    expect((await GET(request("unknown", "load"), context())).status).toBe(409);
  });

  it("refuses a query longer than 200 characters", async () => {
    const response = await GET(request(LOADED_SHA, "x".repeat(201)), context());
    expect(response.status).toBe(400);
  });

  it("returns the matches of a loaded commit", async () => {
    const response = await GET(request(LOADED_SHA, "E_PAYLOAD"), context());
    expect(await response.json()).toEqual({ results: [MATCH] });
  });
});
