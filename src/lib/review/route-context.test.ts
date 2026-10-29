import { describe, expect, it, vi } from "vitest";
import type { PreparedReview } from "./prepare";

process.env.REVIEW_QUEUE_DB = ":memory:";

const LOADED_SHA = "abc123";
const LOADED_REVIEW = {
  data: { pr: { ref: { owner: "acme", repo: "app", number: 7 } } },
} as unknown as PreparedReview;
const preparedReviews = new Map<string, Promise<PreparedReview>>();
preparedReviews.set(`acme/app#7@${LOADED_SHA}`, Promise.resolve(LOADED_REVIEW));
(globalThis as { reviewQueuePrepared?: unknown }).reviewQueuePrepared = preparedReviews;

const { withPreparedReview, withPullRequest } = await import("./route-context");

function context(number = "7") {
  return { params: Promise.resolve({ owner: "acme", repo: "app", number }) };
}

describe("withPullRequest", () => {
  it("answers 400 for a bad reference without calling the handler", async () => {
    const handler = vi.fn(async () => Response.json({}));
    const response = await withPullRequest(handler)(new Request("http://test/api"), context("x"));
    expect(response.status).toBe(400);
    expect(handler).not.toHaveBeenCalled();
  });
});

describe("withPreparedReview", () => {
  it("passes the loaded review to the handler", async () => {
    const handler = vi.fn(async () => Response.json({}));
    await withPreparedReview(handler)(new Request(`http://test/api?sha=${LOADED_SHA}`), context());
    expect(handler).toHaveBeenCalledWith(expect.any(Request), LOADED_REVIEW);
  });

  it("answers 409 for a commit that is not loaded without calling the handler", async () => {
    const handler = vi.fn(async () => Response.json({}));
    const response = await withPreparedReview(handler)(
      new Request("http://test/api?sha=unknown"),
      context(),
    );
    expect(response.status).toBe(409);
    expect(handler).not.toHaveBeenCalled();
  });
});
