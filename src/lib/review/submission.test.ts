import { describe, expect, it } from "vitest";
import type { Note } from "@/lib/types";
import { buildSubmission } from "./submission";

function note(overrides: Partial<Note>): Note {
  return { id: 1, path: null, line: null, kind: "nit", body: "x", createdAt: "", ...overrides };
}

describe("buildSubmission", () => {
  it("turns line notes into comments and the rest into the body", () => {
    const submission = buildSubmission(
      [
        note({ path: "a.ts", line: 4, kind: "blocker", body: "this leaks" }),
        note({ kind: "question", body: "why a new cache?" }),
      ],
      "REQUEST_CHANGES",
      "Close, a couple of things.",
      "abc",
    );
    expect(submission).toEqual({
      event: "REQUEST_CHANGES",
      commitId: "abc",
      body: "Close, a couple of things.\n\n- **Question:** why a new cache?",
      comments: [{ path: "a.ts", line: 4, body: "**Blocker:** this leaks" }],
    });
  });

  it("allows an empty summary", () => {
    expect(buildSubmission([], "APPROVE", "  ", "abc").body).toBe("");
  });
});
