import { describe, expect, it } from "vitest";
import type { Note } from "@/lib/types";
import { buildSubmission } from "./submission";

function note(overrides: Partial<Note>): Note {
  return {
    id: 1,
    path: null,
    line: null,
    side: "new",
    startLine: null,
    kind: "nitpick",
    decorations: [],
    body: "x",
    createdAt: "",
    ...overrides,
  };
}

describe("buildSubmission", () => {
  it("posts an old-side note on the LEFT side and a range with its start line", () => {
    const submission = buildSubmission(
      [
        note({ path: "a.ts", line: 6, side: "old", body: "why removed?" }),
        note({ path: "a.ts", line: 9, startLine: 4, body: "one helper" }),
      ],
      "COMMENT",
      "",
      "abc",
    );
    expect(submission.comments).toEqual([
      { path: "a.ts", line: 6, side: "LEFT", body: expect.stringContaining("why removed?") },
      {
        path: "a.ts",
        line: 9,
        side: "RIGHT",
        startLine: 4,
        body: expect.stringContaining("one helper"),
      },
    ]);
  });

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
      comments: [
        { path: "a.ts", line: 4, side: "RIGHT", body: "**issue (blocking):** this leaks" },
      ],
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

describe("buildSubmission posts well-formed Conventional Comments", () => {
  it.each([
    "```ts\na()\n```",
    "- one\n- two",
    "* one",
    "1. one",
    "> quoted",
    "# Heading",
    "| a | b |",
    "~~~ts\na()\n~~~",
  ])("puts the label on its own line above a block body %j", (body) => {
    const submission = buildSubmission(
      [note({ path: "a.ts", line: 1, kind: "suggestion", body })],
      "COMMENT",
      "",
      "abc",
    );
    expect(submission.comments).toEqual([
      { path: "a.ts", line: 1, side: "RIGHT", body: `**suggestion:**\n\n${body}` },
    ]);
  });

  it("does not repeat a label that the body already starts with", () => {
    const submission = buildSubmission(
      [note({ kind: "question", body: "**question:** why?" })],
      "COMMENT",
      "",
      "abc",
    );
    expect(submission.body).toBe("- **question:** why?");
  });

  it("keeps a leading label that differs from the note's kind", () => {
    const submission = buildSubmission(
      [note({ kind: "question", body: "Suggestion: try x" })],
      "COMMENT",
      "",
      "abc",
    );
    expect(submission.body).toBe("- **question:** Suggestion: try x");
  });

  it("indents the lines after the first of a multi-line general note", () => {
    const submission = buildSubmission(
      [note({ kind: "thought", body: "first\n\n```ts\nx\n```" })],
      "COMMENT",
      "",
      "abc",
    );
    expect(submission.body).toBe("- **thought:** first\n\n  ```ts\n  x\n  ```");
  });
});
