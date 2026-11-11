import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import type { FileLines } from "@/lib/review/file-lines";
import type { PreparedReview } from "@/lib/review/prepare";
import { SymbolIndex } from "@/lib/symbols/symbol-index";

const SHA = "abc123";
const sandbox = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "file-route-")));
const checkout = path.join(sandbox, "checkout");
fs.mkdirSync(path.join(checkout, "src"), { recursive: true });
fs.writeFileSync(path.join(checkout, "src", "notes.txt"), "first\nsecond\n");
fs.writeFileSync(path.join(sandbox, "secret.txt"), "private\n");
fs.symlinkSync(path.join(sandbox, "secret.txt"), path.join(checkout, "link.txt"));

const index = await SymbolIndex.build(checkout, async () => "");
const preparedReviews = new Map<string, Promise<PreparedReview>>();
preparedReviews.set(`acme/app#7@${SHA}`, Promise.resolve({ index } as unknown as PreparedReview));
(globalThis as { reviewQueuePrepared?: unknown }).reviewQueuePrepared = preparedReviews;

const { GET } = await import("./route");

const context = { params: Promise.resolve({ owner: "acme", repo: "app", number: "7" }) };

function fileRequest(query: Record<string, string>): Request {
  return new Request(`http://test/api?${new URLSearchParams({ sha: SHA, ...query })}`);
}

describe("file route", () => {
  afterAll(() => fs.rmSync(sandbox, { recursive: true, force: true }));

  it("returns the lines of a file inside the checkout", async () => {
    const response = await GET(fileRequest({ path: "src/notes.txt" }), context);
    expect(response.status).toBe(200);
    const lines = (await response.json()) as FileLines;
    expect(lines.tokens.map((row) => row.map((token) => token.text).join(""))).toEqual([
      "first",
      "second",
    ]);
  });

  it("refuses a path that climbs out of the checkout", async () => {
    expect((await GET(fileRequest({ path: "../secret.txt" }), context)).status).toBe(400);
  });

  it("refuses a link that points out of the checkout", async () => {
    expect((await GET(fileRequest({ path: "link.txt" }), context)).status).toBe(400);
  });

  it("refuses a missing file and a request with no path", async () => {
    expect((await GET(fileRequest({ path: "src/missing.txt" }), context)).status).toBe(400);
    expect((await GET(fileRequest({}), context)).status).toBe(400);
  });
});
