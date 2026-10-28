import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/review/services", () => ({
  conversation: async () => {
    throw new Error("gh: 500 Server Error");
  },
}));

const { GET } = await import("./route");

function context(number = "7") {
  return { params: Promise.resolve({ owner: "acme", repo: "app", number }) };
}

describe("GET conversation", () => {
  it("answers a fixed 502 and logs once when GitHub fails", async () => {
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});
    const response = await GET(new Request("http://test/api/conversation"), context());
    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({ error: "GitHub request failed" });
    expect(logged).toHaveBeenCalledOnce();
    logged.mockRestore();
  });
});
