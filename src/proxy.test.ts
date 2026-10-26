import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import { proxy } from "./proxy";

const API = "http://127.0.0.1:4477/api/pr/acme/app/7/submit";

function requestFor(headers: Record<string, string>, method = "POST"): NextRequest {
  return new NextRequest(API, { method, headers: { host: "127.0.0.1:4477", ...headers } });
}

const JSON_HEADERS = { origin: "http://127.0.0.1:4477", "content-type": "application/json" };

describe("proxy", () => {
  it("allows same-origin JSON posts and plain reads on loopback", () => {
    expect(proxy(requestFor(JSON_HEADERS)).status).toBe(200);
    expect(proxy(requestFor({}, "GET")).status).toBe(200);
    expect(proxy(requestFor({ host: "localhost:4477" }, "GET")).status).toBe(200);
    expect(proxy(requestFor({ host: "[::1]:4477" }, "GET")).status).toBe(200);
  });

  it("refuses other hosts, so DNS rebinding cannot reach it", () => {
    expect(proxy(requestFor({ host: "evil.example:4477" }, "GET")).status).toBe(403);
    expect(proxy(new NextRequest(API, { headers: {} })).status).toBe(403);
  });

  it("refuses posts from other sites or without a JSON body", () => {
    expect(proxy(requestFor({ ...JSON_HEADERS, origin: "https://evil.example" })).status).toBe(403);
    expect(proxy(requestFor({ ...JSON_HEADERS, "content-type": "text/plain" })).status).toBe(403);
    expect(proxy(requestFor({ "content-type": "application/json" })).status).toBe(403);
    expect(proxy(requestFor({ ...JSON_HEADERS, origin: "null" })).status).toBe(403);
  });
});
