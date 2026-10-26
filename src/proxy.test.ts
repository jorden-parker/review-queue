import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { NextRequest } from "next/server";
import { afterAll, describe, expect, it } from "vitest";
import { loadAccessToken } from "@/lib/access-token";
import { proxy } from "./proxy";

const tokenDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "proxy-token-"));
process.env.REVIEW_QUEUE_TOKEN_FILE = path.join(tokenDirectory, "access-token");
const TOKEN = loadAccessToken();

const API = "http://127.0.0.1:4477/api/pr/acme/app/7/submit";
const SIGNED_IN = { cookie: `review-queue-token=${TOKEN}` };

function requestFor(headers: Record<string, string>, method = "POST", url = API): NextRequest {
  return new NextRequest(url, { method, headers: { host: "127.0.0.1:4477", ...headers } });
}

const SAME_ORIGIN_JSON = { origin: "http://127.0.0.1:4477", "content-type": "application/json" };
const JSON_HEADERS = { ...SIGNED_IN, ...SAME_ORIGIN_JSON };

describe("proxy", () => {
  afterAll(() => fs.rmSync(tokenDirectory, { recursive: true, force: true }));

  it("allows signed-in same-origin JSON posts and plain reads on loopback", () => {
    expect(proxy(requestFor(JSON_HEADERS)).status).toBe(200);
    expect(proxy(requestFor(SIGNED_IN, "GET")).status).toBe(200);
    expect(proxy(requestFor({ ...SIGNED_IN, host: "localhost:4477" }, "GET")).status).toBe(200);
    expect(proxy(requestFor({ ...SIGNED_IN, host: "[::1]:4477" }, "GET")).status).toBe(200);
  });

  it("refuses other hosts, so DNS rebinding cannot reach it", () => {
    expect(proxy(requestFor({ ...SIGNED_IN, host: "evil.example:4477" }, "GET")).status).toBe(403);
    expect(proxy(new NextRequest(API, { headers: {} })).status).toBe(403);
  });

  it("refuses posts from other sites or without a JSON body", () => {
    expect(proxy(requestFor({ ...JSON_HEADERS, origin: "https://evil.example" })).status).toBe(403);
    expect(proxy(requestFor({ ...JSON_HEADERS, "content-type": "text/plain" })).status).toBe(403);
    expect(proxy(requestFor({ ...SIGNED_IN, "content-type": "application/json" })).status).toBe(
      403,
    );
    expect(proxy(requestFor({ ...JSON_HEADERS, origin: "null" })).status).toBe(403);
  });

  it("refuses any request without the access cookie, even with forged same-origin headers", () => {
    expect(proxy(requestFor(SAME_ORIGIN_JSON)).status).toBe(401);
    expect(proxy(requestFor({}, "GET")).status).toBe(401);
    expect(proxy(requestFor({ cookie: "review-queue-token=wrong" }, "GET")).status).toBe(401);
  });

  it("signs the browser in from the token link and strips the token from the URL", () => {
    const response = proxy(
      requestFor({}, "GET", `http://127.0.0.1:4477/pr/a/b/1?token=${TOKEN}&tab=notes`),
    );
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("http://127.0.0.1:4477/pr/a/b/1?tab=notes");
    const cookie = response.cookies.get("review-queue-token");
    expect(cookie).toMatchObject({ value: TOKEN, httpOnly: true, sameSite: "strict", path: "/" });
  });

  it("forbids framing on every response", () => {
    for (const response of [proxy(requestFor(SIGNED_IN, "GET")), proxy(requestFor({}, "GET"))]) {
      expect(response.headers.get("x-frame-options")).toBe("DENY");
      expect(response.headers.get("content-security-policy")).toBe("frame-ancestors 'none'");
    }
  });
});
