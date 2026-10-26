import { describe, expect, it } from "vitest";
import { addedHunk, fileDiff } from "@/test/diff-builders";
import { reviewPayload } from "@/test/review-fixture";
import { type AssistRequest, AssistRequestSchema, assistInputFrom } from "./assist-request";
import type { ReviewData } from "./prepare";

const DATA: ReviewData = {
  ...reviewPayload(),
  files: [
    {
      ...fileDiff("src/a.ts", [addedHunk(["a1", "a2", "a3"], 1), addedHunk(["b1", "b2"], 20)]),
      highlighted: [],
      navigable: true,
    },
  ],
};

const REQUEST: AssistRequest = {
  action: "explain",
  path: "src/a.ts",
  from: { hunk: 0, line: 1 },
  to: { hunk: 1, line: 0 },
  question: null,
  history: [],
};

describe("assistInputFrom", () => {
  it("takes the selected lines from the server's own diff, across hunks", () => {
    const result = assistInputFrom(DATA, REQUEST);
    if (!result.ok) throw new Error(result.error);
    expect(result.input.selected.map((line) => line.text)).toEqual(["a2", "a3", "b1"]);
    expect(result.input.context).toHaveLength(2);
    expect(result.input.title).toBe(DATA.pr.title);
  });

  it("rejects an unknown file", () => {
    expect(assistInputFrom(DATA, { ...REQUEST, path: "nope.ts" })).toEqual({
      ok: false,
      error: "That file is not in this review",
    });
  });

  it("rejects line positions outside the diff", () => {
    const result = assistInputFrom(DATA, { ...REQUEST, to: { hunk: 1, line: 9 } });
    expect(result).toEqual({ ok: false, error: "Those lines are not in this diff" });
  });

  it("rejects a selection that ends before it starts", () => {
    const result = assistInputFrom(DATA, {
      ...REQUEST,
      from: { hunk: 1, line: 0 },
      to: { hunk: 0, line: 0 },
    });
    expect(result.ok).toBe(false);
  });
});

describe("AssistRequestSchema", () => {
  it("accepts a follow-up history that alternates and ends with the reviewer", () => {
    const history = [
      { role: "assistant", content: "It adds a." },
      { role: "user", content: "Why?" },
    ];
    expect(AssistRequestSchema.safeParse({ ...REQUEST, history }).success).toBe(true);
  });

  it("rejects a history that does not alternate", () => {
    const history = [
      { role: "user", content: "Why?" },
      { role: "user", content: "Why?" },
    ];
    expect(AssistRequestSchema.safeParse({ ...REQUEST, history }).success).toBe(false);
  });

  it("rejects an overlong question", () => {
    expect(AssistRequestSchema.safeParse({ ...REQUEST, question: "x".repeat(3000) }).success).toBe(
      false,
    );
  });
});
