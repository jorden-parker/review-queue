import { describe, expect, it } from "vitest";
import type { Note } from "@/lib/types";
import { buildSubmission } from "./submission";

function note(overrides: Partial<Note>): Note {
  return {
    id: 1,
    path: null,
    line: null,
    kind: "nitpick",
    decorations: [],
    body: "x",
    createdAt: "",
    ...overrides,
  };
}

describe("buildSubmission", () => {
  it("turns line notes into comments and the rest into the body", () => {
    const submission = buildSubmission(
      [
        note({
          path: "a.ts",
          line: 4,
          kind: "issue",
          decorations: ["blocking"],
          body: "this leaks",
        }),
        note({ kind: "question", body: "why a new cache?" }),
      ],
      "REQUEST_CHANGES",
      "Close, a couple of things.",
      "abc",
    );
    expect(submission).toEqual({
      event: "REQUEST_CHANGES",
      commitId: "abc",
      body: "Close, a couple of things.\n\n- **question:** why a new cache?",
      comments: [{ path: "a.ts", line: 4, body: "**issue (blocking):** this leaks" }],
    });
  });

  it("posts praise under its own Conventional Comments label", () => {
    const submission = buildSubmission(
      [note({ kind: "praise", body: "clean split" })],
      "COMMENT",
      "",
      "abc",
    );
    expect(submission.body).toBe("- **praise:** clean split");
  });

  it("allows an empty summary", () => {
    expect(buildSubmission([], "APPROVE", "  ", "abc").body).toBe("");
  });

  it("never posts a parked note, even when it is selected", () => {
    const submission = buildSubmission(
      [note({ kind: "parked", body: "lunch" }), note({ id: 2, kind: "nitpick", body: "rename" })],
      "COMMENT",
      "",
      "abc",
    );
    expect(submission.body).toBe("- **nitpick:** rename");
    expect(submission.comments).toEqual([]);
  });
});
