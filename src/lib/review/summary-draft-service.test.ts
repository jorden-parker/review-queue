import { describe, expect, it } from "vitest";
import type { Note } from "@/lib/types";
import { summaryDraftFor } from "./summary-draft-service";

const NOTES: Note[] = [
  {
    id: 1,
    path: "src/a.ts",
    line: 3,
    kind: "nit",
    body: "Rename this",
    createdAt: "2026-10-26T10:00:00Z",
  },
];
const CONFIG = { baseURL: "http://llm.test", model: "m", enabled: true, timeoutMs: 1000 };
const OFF = { ...CONFIG, enabled: false };

function reply(text: string): Response {
  return new Response(
    JSON.stringify({
      id: "msg_1",
      type: "message",
      role: "assistant",
      model: "m",
      content: [{ type: "text", text }],
      stop_reason: "end_turn",
      stop_sequence: null,
      usage: { input_tokens: 1, output_tokens: 1 },
    }),
    { status: 200, headers: { "content-type": "application/json" } },
  );
}

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
      reply(`{"summary": "Mostly fine; one rename."}`)) as typeof fetch;
    expect(await summaryDraftFor("Add cache", "COMMENT", NOTES, CONFIG, fetchImpl)).toEqual({
      status: "ready",
      summary: "Mostly fine; one rename.",
    });
  });

  it("reports the server failure as an error", async () => {
    const failing = (async () => Response.json({}, { status: 503 })) as typeof fetch;
    const result = await summaryDraftFor("Add cache", "COMMENT", NOTES, CONFIG, failing);
    expect(result).toMatchObject({ status: "error" });
    expect(result).toHaveProperty("message", expect.stringContaining("HTTP 503"));
  });
});
