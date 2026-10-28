import { describe, expect, it } from "vitest";

process.env.REVIEW_QUEUE_DB = ":memory:";

const { POST } = await import("./route");

function context(number = "7") {
  return { params: Promise.resolve({ owner: "acme", repo: "app", number }) };
}

function request(body: unknown) {
  return new Request("http://test/api", { method: "POST", body: JSON.stringify(body) });
}

describe("POST session", () => {
  it("applies an action and returns the session", async () => {
    const response = await POST(request({ type: "pause", note: "later" }), context());
    expect((await response.json()).pause.note).toBe("later");
  });

  it("rejects bad refs and actions", async () => {
    expect((await POST(request({ type: "resume" }), context("x"))).status).toBe(400);
    expect((await POST(request({ type: "nope" }), context())).status).toBe(400);
  });

  it("archives a session", async () => {
    const response = await POST(request({ type: "archive" }), context("9"));
    expect(response.status).toBe(200);
  });

  it("answers 400 for a body that is not JSON", async () => {
    const response = await POST(
      new Request("http://test/api", { method: "POST", body: "{nope" }),
      context(),
    );
    expect(response.status).toBe(400);
  });
});
