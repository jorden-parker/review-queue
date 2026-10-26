import { describe, expect, it, vi } from "vitest";
import { positionFromQuery, symbolLookupRoute } from "./symbol-query";

const parse = (query: string) => positionFromQuery(new URLSearchParams(query));

describe("positionFromQuery", () => {
  it("reads a full position", () => {
    expect(parse("name=load&path=src/a.ts&line=4&character=9&side=new")).toEqual({
      name: "load",
      path: "src/a.ts",
      line: 4,
      character: 9,
      side: "new",
    });
  });

  it("treats a name-only query as an index lookup", () => {
    expect(parse("name=load")).toMatchObject({ name: "load", path: "", side: "old" });
  });

  it("rejects a missing name or a nonsense position", () => {
    expect(parse("path=a.ts")).toBeNull();
    expect(parse("name=load&line=-2")).toBeNull();
    expect(parse("name=load&side=sideways")).toBeNull();
  });
});

describe("symbolLookupRoute", () => {
  const context = (number: string) => ({
    params: Promise.resolve({ owner: "acme", repo: "app", number }),
  });

  it("rejects a bad reference or a review that is not loaded before looking anything up", async () => {
    const lookup = vi.fn();
    const GET = symbolLookupRoute(lookup);
    const request = new Request("http://test/api?sha=abc&name=load");
    expect((await GET(request, context("x"))).status).toBe(400);
    expect((await GET(request, context("7"))).status).toBe(409);
    expect(lookup).not.toHaveBeenCalled();
  });
});
