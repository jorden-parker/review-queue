import { describe, expect, it } from "vitest";

process.env.REVIEW_QUEUE_DB = ":memory:";

const { POST } = await import("./route");

function context(number = "7") {
  return { params: Promise.resolve({ owner: "acme", repo: "app", number }) };
}

function request(sha: string) {
  return new Request(`http://test/api/seen?sha=${sha}`, { method: "POST", body: "{}" });
}

describe("POST seen", () => {
  it("answers 409 for a head that is not loaded", async () => {
    expect((await POST(request("f".repeat(40)), context())).status).toBe(409);
  });

  it("rejects a bad reference", async () => {
    expect((await POST(request("f".repeat(40)), context("x"))).status).toBe(400);
  });
});
