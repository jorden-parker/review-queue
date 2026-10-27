import { describe, expect, it } from "vitest";
import type { ReviewRequest } from "@/lib/github/gh";
import type { ProgressSummary } from "@/lib/session/store";
import { movedSinceVisit, orderQueue } from "./queue";

const SEEN_AT = "2026-10-26T09:00:00.000Z";
const LATER = "2026-10-26T11:00:00.000Z";

function request(number: number, updatedAt: string = SEEN_AT): ReviewRequest {
  return {
    ref: { owner: "acme", repo: "app", number },
    title: `PR ${number}`,
    url: `https://github.com/acme/app/pull/${number}`,
    author: "sam",
    updatedAt,
    isDraft: false,
  };
}

function progress(overrides: Partial<ProgressSummary> = {}): ProgressSummary {
  return {
    doneCount: 1,
    noteCount: 0,
    lastHeadSha: "sha1",
    updatedAt: SEEN_AT,
    pause: null,
    ...overrides,
  };
}

describe("movedSinceVisit", () => {
  it("is true when GitHub updated the PR after the reviewer last touched it", () => {
    expect(movedSinceVisit(request(1, LATER), progress({ updatedAt: SEEN_AT }))).toBe(true);
  });

  it("is false when the PR has not changed since the reviewer's last touch", () => {
    expect(movedSinceVisit(request(1, SEEN_AT), progress({ updatedAt: SEEN_AT }))).toBe(false);
  });

  it("is false for a PR the reviewer has not started", () => {
    expect(movedSinceVisit(request(1, LATER), null)).toBe(false);
  });
});

describe("orderQueue", () => {
  it("puts paused PRs first, then in-progress, then not started, each keeping GitHub's order", () => {
    const requests = [request(1), request(2), request(3), request(4)];
    const byKey = {
      "acme/app#2": progress(),
      "acme/app#3": progress({ pause: { note: "read the tests", at: SEEN_AT } }),
    };

    const order = orderQueue(requests, byKey).map((entry) => entry.request.ref.number);

    expect(order).toEqual([3, 2, 1, 4]);
  });

  it("marks each entry with its progress and whether it moved since the visit", () => {
    const requests = [request(1, LATER), request(2)];
    const byKey = { "acme/app#1": progress({ updatedAt: SEEN_AT }) };

    expect(orderQueue(requests, byKey)).toEqual([
      { request: requests[0], progress: byKey["acme/app#1"], movedSinceVisit: true },
      { request: requests[1], progress: null, movedSinceVisit: false },
    ]);
  });
});
