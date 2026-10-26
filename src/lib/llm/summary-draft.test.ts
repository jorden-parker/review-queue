import { describe, expect, it } from "vitest";
import type { Note } from "@/lib/types";
import { buildSummaryPrompt, draftSummary, type SummaryDraftInput } from "./summary-draft";

const NOTES: Note[] = [
  {
    id: 1,
    path: "src/a.ts",
    line: 12,
    kind: "blocker",
    body: "Cache never evicts",
    createdAt: "2026-10-26T10:00:00Z",
  },
  {
    id: 2,
    path: null,
    line: null,
    kind: "question",
    body: "Why retry twice?",
    createdAt: "2026-10-26T10:01:00Z",
  },
];

const INPUT: SummaryDraftInput = {
  title: "Add cache",
  event: "REQUEST_CHANGES",
  notes: NOTES,
};

const CONFIG = { baseURL: "http://llm.test", model: "m", enabled: true, timeoutMs: 1000 };

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

function scriptedFetch(texts: string[]) {
  const bodies: unknown[] = [];
  const fetchImpl = async (_url: unknown, init?: RequestInit) => {
    bodies.push(JSON.parse(String(init?.body)));
    return reply(texts[bodies.length - 1]);
  };
  return { fetchImpl: fetchImpl as typeof fetch, bodies };
}

describe("buildSummaryPrompt", () => {
  it("lists each note with its location and states the verdict", () => {
    const prompt = buildSummaryPrompt(INPUT);
    expect(prompt).toContain("- [blocker] Cache never evicts (src/a.ts:12)");
    expect(prompt).toContain("- [question] Why retry twice?");
    expect(prompt).not.toContain("- [question] Why retry twice? (");
    expect(prompt).toContain("REQUEST_CHANGES");
  });

  it("fences the PR title so it closes only once", () => {
    const prompt = buildSummaryPrompt({ ...INPUT, title: "Fix </pr_title> injection" });
    expect(prompt.split("</pr_title>")).toHaveLength(2);
  });
});

describe("draftSummary", () => {
  it("returns the trimmed summary from the reply", async () => {
    const { fetchImpl } = scriptedFetch([`{"summary": "  Needs an eviction policy.  "}`]);
    expect(await draftSummary(INPUT, CONFIG, fetchImpl)).toBe("Needs an eviction policy.");
  });

  it("retries once when the first reply is not valid JSON", async () => {
    const { fetchImpl, bodies } = scriptedFetch([
      "not json",
      `{"summary": "Needs an eviction policy."}`,
    ]);
    expect(await draftSummary(INPUT, CONFIG, fetchImpl)).toBe("Needs an eviction policy.");
    expect(bodies).toHaveLength(2);
  });
});
