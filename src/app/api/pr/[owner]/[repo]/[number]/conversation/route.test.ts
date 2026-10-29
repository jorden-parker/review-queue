import { beforeEach, describe, expect, it, vi } from "vitest";

const conversationView = vi.hoisted(() => vi.fn());

vi.mock("@/lib/review/services", () => ({ conversationView }));

const { GET } = await import("./route");

function context(number = "7") {
  return { params: Promise.resolve({ owner: "acme", repo: "app", number }) };
}

describe("GET conversation", () => {
  beforeEach(() => {
    conversationView.mockReset();
  });

  it("answers a fixed 502 and logs once when GitHub fails", async () => {
    conversationView.mockRejectedValue(new Error("gh: 500 Server Error"));
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});
    const response = await GET(new Request("http://test/api/conversation"), context());
    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({ error: "GitHub request failed" });
    expect(logged).toHaveBeenCalledOnce();
    logged.mockRestore();
  });

  it("returns the conversation together with the signed-in viewer", async () => {
    const view = { comments: [], reviews: [], truncated: false, viewer: "me" };
    conversationView.mockResolvedValue(view);
    const response = await GET(new Request("http://test/api/conversation"), context());
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(view);
  });
});
