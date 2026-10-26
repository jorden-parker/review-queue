import { describe, expect, it } from "vitest";
import { conditionalGet, type EtagCache } from "./conditional-get";

function memoryCache(): EtagCache {
  const values = new Map<string, string>();
  return {
    getCached: (key) => values.get(key) ?? null,
    setCached: (key, value) => void values.set(key, value),
  };
}

function okResponse(etag: string | null, body: string): string {
  const headers = ["HTTP/2.0 200 OK", "Content-Type: application/json"];
  if (etag) headers.push(`Etag: ${etag}`);
  return `${headers.join("\r\n")}\r\n\r\n${body}`;
}

function scriptedRunner(responses: (string | Error)[]) {
  const calls: string[][] = [];
  const run = async (_command: string, args: string[]) => {
    calls.push(args);
    const next = responses.shift();
    if (next instanceof Error) throw next;
    return next ?? "";
  };
  return { run, calls };
}

const NOT_MODIFIED = new Error("gh api -i repos/a/b failed: gh: HTTP 304");

describe("conditionalGet", () => {
  it("fetches without a validator the first time and returns the body", async () => {
    const { run, calls } = scriptedRunner([okResponse('W/"v1"', '{"n":1}')]);
    const body = await conditionalGet("repos/a/b", memoryCache(), run);
    expect(body).toBe('{"n":1}');
    expect(calls[0]).toEqual(["api", "-i", "repos/a/b"]);
  });

  it("revalidates with the stored etag and reuses the body on 304", async () => {
    const cache = memoryCache();
    const { run, calls } = scriptedRunner([okResponse('W/"v1"', '{"n":1}'), NOT_MODIFIED]);
    await conditionalGet("repos/a/b", cache, run);
    const body = await conditionalGet("repos/a/b", cache, run);
    expect(body).toBe('{"n":1}');
    expect(calls[1]).toEqual(["api", "-i", "repos/a/b", "-H", 'If-None-Match: W/"v1"']);
  });

  it("replaces the stored body when the resource changed", async () => {
    const cache = memoryCache();
    const { run, calls } = scriptedRunner([
      okResponse('W/"v1"', '{"n":1}'),
      okResponse('W/"v2"', '{"n":2}'),
      NOT_MODIFIED,
    ]);
    await conditionalGet("repos/a/b", cache, run);
    expect(await conditionalGet("repos/a/b", cache, run)).toBe('{"n":2}');
    expect(await conditionalGet("repos/a/b", cache, run)).toBe('{"n":2}');
    expect(calls[2]).toContain('If-None-Match: W/"v2"');
  });

  it("does not store responses without an etag", async () => {
    const cache = memoryCache();
    const { run, calls } = scriptedRunner([okResponse(null, "{}"), okResponse(null, "{}")]);
    await conditionalGet("repos/a/b", cache, run);
    await conditionalGet("repos/a/b", cache, run);
    expect(calls[1]).toEqual(["api", "-i", "repos/a/b"]);
  });

  it("propagates other failures", async () => {
    const cache = memoryCache();
    const { run } = scriptedRunner([
      okResponse('W/"v1"', "{}"),
      new Error("gh: HTTP 404 Not Found"),
    ]);
    await conditionalGet("repos/a/b", cache, run);
    await expect(conditionalGet("repos/a/b", cache, run)).rejects.toThrow("HTTP 404");
  });

  it("propagates a 304 when nothing is stored", async () => {
    const { run } = scriptedRunner([NOT_MODIFIED]);
    await expect(conditionalGet("repos/a/b", memoryCache(), run)).rejects.toThrow("HTTP 304");
  });
});
