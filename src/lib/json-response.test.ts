import { describe, expect, it } from "vitest";
import { json, postJson } from "./json-response";

describe("json", () => {
  it("returns the parsed body of a successful response", async () => {
    expect(await json<{ ok: boolean }>(Response.json({ ok: true }))).toEqual({ ok: true });
  });

  it("uses the server's error message when a failure body is JSON", async () => {
    await expect(json(Response.json({ error: "nope" }, { status: 400 }))).rejects.toThrow("nope");
  });

  it("names the status when a failure body is not JSON", async () => {
    const response = new Response("<html>Bad Gateway</html>", {
      status: 502,
      statusText: "Bad Gateway",
    });
    await expect(json(response)).rejects.toThrow("Request failed (502 Bad Gateway)");
  });

  it("names the status when a failure body is JSON without an error field", async () => {
    await expect(json(Response.json({ detail: 1 }, { status: 500 }))).rejects.toThrow(
      "Request failed (500)",
    );
  });
});

describe("postJson", () => {
  it("sends a JSON body with the method and reads the JSON answer", async () => {
    const calls: [string, RequestInit][] = [];
    const fetchImpl = (async (url: string, init: RequestInit) => {
      calls.push([url, init]);
      return Response.json({ done: true });
    }) as unknown as typeof fetch;
    expect(await postJson<{ done: boolean }>("/api/x", { a: 1 }, "PUT", fetchImpl)).toEqual({
      done: true,
    });
    expect(calls[0][0]).toBe("/api/x");
    expect(calls[0][1]).toMatchObject({
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ a: 1 }),
    });
  });
});
