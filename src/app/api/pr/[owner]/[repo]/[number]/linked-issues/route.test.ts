import { beforeEach, describe, expect, it, vi } from "vitest";
import type { LinkedIssue } from "@/lib/github/gh";

const { linkedIssues } = vi.hoisted(() => ({ linkedIssues: vi.fn() }));

vi.mock("@/lib/review/services", () => ({ linkedIssues }));

const { GET } = await import("./route");

const ISSUE: LinkedIssue = {
  owner: "acme",
  repo: "app",
  number: 12,
  title: "Crash on save",
  state: "open",
  url: "https://github.com/acme/app/issues/12",
  bodyHtml: "<p>It crashes</p>",
};

function context(number = "7") {
  return { params: Promise.resolve({ owner: "acme", repo: "app", number }) };
}

describe("GET linked-issues", () => {
  beforeEach(() => {
    linkedIssues.mockReset();
  });

  it("answers the issues a PR closes", async () => {
    linkedIssues.mockResolvedValue([ISSUE]);
    const response = await GET(new Request("http://test/api/linked-issues"), context());
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ issues: [ISSUE] });
  });

  it("answers a fixed 502 and logs once when GitHub fails", async () => {
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});
    linkedIssues.mockRejectedValue(new Error("gh: 500 Server Error"));
    const response = await GET(new Request("http://test/api/linked-issues"), context());
    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({ error: "GitHub request failed" });
    expect(logged).toHaveBeenCalledOnce();
    logged.mockRestore();
  });
});
