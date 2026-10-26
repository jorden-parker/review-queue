import { describe, expect, it } from "vitest";

process.env.REVIEW_QUEUE_DB = ":memory:";

const { POST } = await import("./route");

function context(number = "7") {
  return { params: Promise.resolve({ owner: "acme", repo: "app", number }) };
}

function request(sha: string) {
  return new Request(`http://test/api?sha=${sha}`, { method: "POST", body: "{}" });
}

describe("POST assist", () => {
  it("rejects a bad ref", async () => {
    expect((await POST(request("abc"), context("x"))).status).toBe(400);
  });

  it("asks for a reload when that commit is not loaded", async () => {
    expect((await POST(request("abc"), context())).status).toBe(409);
  });
});
