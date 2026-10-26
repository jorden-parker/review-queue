import { describe, expect, it } from "vitest";
import { addedHunk, fileDiff } from "@/test/diff-builders";
import { reviewPayload } from "@/test/review-fixture";
import type { FileDiff } from "@/lib/types";
import {
  type AssistRequest,
  AssistRequestSchema,
  type AssistSource,
  assistInputFrom,
} from "./assist-request";
import type { PreparedFile } from "./prepare";

function prepared(diff: FileDiff): PreparedFile {
  return { ...diff, highlighted: [], navigable: true };
}

const FILES: PreparedFile[] = [
  prepared(fileDiff("src/a.ts", [addedHunk(["a1", "a2", "a3"], 1), addedHunk(["b1", "b2"], 20)])),
  prepared(fileDiff("src/gone.ts", [addedHunk(["x"], 1)], { status: "deleted" })),
  prepared(fileDiff("logo.png", [], { binary: true })),
];

const HEAD_FILES: Record<string, string> = { "src/a.ts": "whole a" };

const SOURCE: AssistSource = {
  data: { ...reviewPayload(), files: FILES },
  index: {
    readFile: (path) => {
      const text = HEAD_FILES[path];
      if (text === undefined) throw new Error(`missing ${path}`);
      return text;
    },
  },
};

const LINES = {
  kind: "lines" as const,
  range: { path: "src/a.ts", from: { hunk: 0, line: 1 }, to: { hunk: 1, line: 0 } },
};

const REQUEST: AssistRequest = { action: "explain", target: LINES, question: null, history: [] };

function fileRequest(path: string): AssistRequest {
  return { ...REQUEST, target: { kind: "file", path } };
}

function withRange(from: [number, number], to: [number, number]): AssistRequest {
  return {
    ...REQUEST,
    target: {
      kind: "lines",
      range: {
        path: "src/a.ts",
        from: { hunk: from[0], line: from[1] },
        to: { hunk: to[0], line: to[1] },
      },
    },
  };
}

describe("assistInputFrom", () => {
  it("takes the selected lines from the server's own diff, across hunks", () => {
    const result = assistInputFrom(SOURCE, REQUEST);
    if (!result.ok) throw new Error(result.error);
    expect(result.input.selected.map((line) => line.text)).toEqual(["a2", "a3", "b1"]);
    expect(result.input.context).toHaveLength(2);
    expect(result.input.title).toBe(SOURCE.data.pr.title);
    expect(result.input.scope).toBe("lines");
    expect(result.input.fileText).toBeNull();
  });

  it("rejects an unknown file", () => {
    expect(assistInputFrom(SOURCE, fileRequest("nope.ts"))).toEqual({
      ok: false,
      error: "That file is not in this review",
    });
  });

  it("rejects line positions outside the diff", () => {
    const result = assistInputFrom(SOURCE, withRange([0, 1], [1, 9]));
    expect(result).toEqual({ ok: false, error: "Those lines are not in this diff" });
  });

  it("rejects a selection that ends before it starts", () => {
    expect(assistInputFrom(SOURCE, withRange([1, 0], [0, 0])).ok).toBe(false);
  });

  it("sends a whole file with every hunk and the file at the PR head", () => {
    const result = assistInputFrom(SOURCE, fileRequest("src/a.ts"));
    if (!result.ok) throw new Error(result.error);
    expect(result.input.scope).toBe("file");
    expect(result.input.fileText).toBe("whole a");
    expect(result.input.context).toHaveLength(2);
    expect(result.input.selected).toEqual([]);
  });

  it("sends only the diff of a deleted file", () => {
    const result = assistInputFrom(SOURCE, fileRequest("src/gone.ts"));
    if (!result.ok) throw new Error(result.error);
    expect(result.input.fileText).toBeNull();
    expect(result.input.context).toHaveLength(1);
  });

  it("rejects a binary file", () => {
    expect(assistInputFrom(SOURCE, fileRequest("logo.png"))).toEqual({
      ok: false,
      error: "Binary files cannot be sent to the model",
    });
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
