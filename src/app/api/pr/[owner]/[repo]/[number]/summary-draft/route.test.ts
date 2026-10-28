import { describe, expect, it } from "vitest";

process.env.REVIEW_QUEUE_DB = ":memory:";

const LOADED_SHA = "abc123";
const preparedReviews = new Map<string, Promise<unknown>>();
preparedReviews.set(`acme/app#7@${LOADED_SHA}`, Promise.resolve({}));
(globalThis as { reviewQueuePrepared?: unknown }).reviewQueuePrepared = preparedReviews;

const { POST } = await import("./route");

function context(number = "7") {
  return { params: Promise.resolve({ owner: "acme", repo: "app", number }) };
}

function request(body: string) {
  return new Request(`http://test/api/summary-draft?sha=${LOADED_SHA}`, { method: "POST", body });
}

describe("POST summary-draft", () => {
  it("answers 400 for a body that is not JSON", async () => {
    expect((await POST(request("{nope"), context())).status).toBe(400);
  });

  it("answers 400 for a body that fails the schema", async () => {
    const body = JSON.stringify({ event: "NOPE", noteIds: [] });
    expect((await POST(request(body), context())).status).toBe(400);
  });
});
