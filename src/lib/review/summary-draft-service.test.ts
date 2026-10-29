import { describe, expect, it, vi } from "vitest";
import type { Note } from "@/lib/types";
import { summaryDraftFor } from "./summary-draft-service";
import { modelReply } from "@/test/fake-llm";

const NOTES: Note[] = [
  {
    side: "new",
    startLine: null,
    id: 1,
    path: "src/a.ts",
    line: 3,
    kind: "nitpick",
    decorations: [],
    body: "Rename this",
    createdAt: "2026-10-26T10:00:00Z",
  },
];
const CONFIG = {
  baseURL: "http://llm.test",
  model: "m",
  enabled: true,
  thinking: true,
  timeoutMs: 1000,
};
const OFF = { ...CONFIG, enabled: false };

describe("summaryDraftFor", () => {
  it("reports disabled without calling the model", async () => {
    const neverCalled = (async () => {
      throw new Error("should not be called");
    }) as typeof fetch;
    expect(await summaryDraftFor("Add cache", "COMMENT", NOTES, OFF, neverCalled)).toEqual({
      status: "disabled",
    });
  });

  it("returns the drafted summary as ready", async () => {
    const fetchImpl = (async () =>
      modelReply(`{"summary": "Mostly fine; one rename."}`)) as typeof fetch;
    expect(await summaryDraftFor("Add cache", "COMMENT", NOTES, CONFIG, fetchImpl)).toEqual({
      status: "ready",
      summary: "Mostly fine; one rename.",
    });
  });

  it("reports the server failure as an error", async () => {
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});
    const failing = (async () => Response.json({}, { status: 503 })) as typeof fetch;
    const result = await summaryDraftFor("Add cache", "COMMENT", NOTES, CONFIG, failing);
    expect(result).toMatchObject({ status: "error" });
    expect(result).toHaveProperty("message", expect.stringContaining("HTTP 503"));
    expect(logged).toHaveBeenCalledOnce();
    expect(logged.mock.calls[0][0]).toContain("review-queue: summary draft failed");
    logged.mockRestore();
  });
});
