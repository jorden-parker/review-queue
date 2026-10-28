import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/review/prepare", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/review/prepare")>()),
  loadReview: async () => {
    throw new Error("git clone failed");
  },
}));

process.env.REVIEW_QUEUE_DB = ":memory:";

const { GET } = await import("./route");

function context(number = "7") {
  return { params: Promise.resolve({ owner: "acme", repo: "app", number }) };
}

describe("GET review", () => {
  it("answers 400 for a bad reference", async () => {
    expect((await GET(new Request("http://test/api"), context("x"))).status).toBe(400);
  });

  it("answers a fixed 502 and logs once when loading fails", async () => {
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});
    const response = await GET(new Request("http://test/api"), context());
    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({ error: "GitHub request failed" });
    expect(logged).toHaveBeenCalledOnce();
    logged.mockRestore();
  });
});
