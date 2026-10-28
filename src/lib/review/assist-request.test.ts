import { describe, expect, it } from "vitest";
import { addedHunk, fileDiff } from "@/test/diff-builders";
import { reviewPayload } from "@/test/review-fixture";
import { checksFor } from "@/lib/hotspots/checks";
import type { FileDiff, Hotspot, Step } from "@/lib/types";
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
    listFiles: async () => Object.keys(HEAD_FILES),
    definitionsOf: () => [],
    referencesTo: async () => [],
    search: async () => [],
    readLines: () => [],
  },
  explanationOf: () => null,
  suggestedHotspots: () => [],
};

const CHECK_STEP: Step = {
  id: "core:src/a.ts:0",
  title: "a.ts",
  role: "core",
  reason: "Holds a.",
  changedLines: 5,
  files: [{ path: "src/a.ts", hunkIndexes: [0] }],
};

const EXPLANATION = { model: "m", what: "w", checks: ["Is the key stable?"] };

const CHECK_SOURCE: AssistSource = {
  ...SOURCE,
  data: { ...SOURCE.data, steps: [CHECK_STEP] },
  explanationOf: () => EXPLANATION,
};

function checkRequest(check: number, action: AssistRequest["action"] = "explain"): AssistRequest {
  return {
    ...REQUEST,
    action,
    target: { kind: "check", stepId: CHECK_STEP.id, check, path: "src/a.ts" },
  };
}

const LINES = {
  kind: "lines" as const,
  range: { path: "src/a.ts", from: { hunk: 0, line: 1 }, to: { hunk: 1, line: 0 } },
};

const FLAG: Hotspot = {
  id: "debug-output:src/a.ts:2",
  rule: "debug-output",
  severity: "low",
  path: "src/a.ts",
  line: 2,
  title: "Debug output left in",
  why: "Remove it.",
};

const OTHER_FILE_FLAG: Hotspot = { ...FLAG, id: "debug-output:src/b.ts:2", path: "src/b.ts" };

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

  it("sends the flags on the selected lines with a check", () => {
    const flagged = { ...SOURCE, data: { ...SOURCE.data, hotspots: [FLAG, OTHER_FILE_FLAG] } };
    const result = assistInputFrom(flagged, { ...withRange([0, 1], [0, 1]), action: "check" });
    if (!result.ok) throw new Error(result.error);
    expect(result.input.flags).toEqual([
      { title: FLAG.title, why: FLAG.why, checks: checksFor(FLAG.rule) },
    ]);
  });

  it("sends the model's own suggested flags on the selected lines with a check", () => {
    const suggested = { path: "src/a.ts", line: 2, title: "Odd retry", why: "Loops forever." };
    const flagged = { ...SOURCE, suggestedHotspots: () => [suggested] };
    const result = assistInputFrom(flagged, { ...withRange([0, 1], [0, 1]), action: "check" });
    if (!result.ok) throw new Error(result.error);
    expect(result.input.flags).toEqual([
      { title: "Odd retry", why: "Loops forever.", checks: checksFor("ai") },
    ]);
  });

  it("rejects a check on lines that have no flags", () => {
    const flagged = { ...SOURCE, data: { ...SOURCE.data, hotspots: [FLAG] } };
    expect(assistInputFrom(flagged, { ...withRange([0, 0], [0, 0]), action: "check" })).toEqual({
      ok: false,
      error: "Those lines have no flags",
    });
  });

  it("sends no flags with other actions", () => {
    const flagged = { ...SOURCE, data: { ...SOURCE.data, hotspots: [FLAG] } };
    const result = assistInputFrom(flagged, REQUEST);
    if (!result.ok) throw new Error(result.error);
    expect(result.input.flags).toEqual([]);
  });

  it("rejects a binary file", () => {
    expect(assistInputFrom(SOURCE, fileRequest("logo.png"))).toEqual({
      ok: false,
      error: "Binary files cannot be sent to the model",
    });
  });
});

describe("assistInputFrom for a step check", () => {
  it("sends the check text and only the step's own hunks", () => {
    const result = assistInputFrom(CHECK_SOURCE, checkRequest(0));
    if (!result.ok) throw new Error(result.error);
    expect(result.input.scope).toBe("check");
    expect(result.input.stepCheck?.text).toBe("Is the key stable?");
    expect(result.input.stepCheck?.step).toEqual(CHECK_STEP);
    const hunks = result.input.stepCheck?.diffs.flatMap((diff) => diff.hunks) ?? [];
    expect(hunks).toHaveLength(1);
    expect(hunks[0].lines.map((line) => line.text)).toEqual(["a1", "a2", "a3"]);
  });

  it("allows only explain and ask", () => {
    expect(assistInputFrom(CHECK_SOURCE, checkRequest(0, "simplify"))).toEqual({
      ok: false,
      error: "Only explain and ask work on a step check",
    });
    expect(assistInputFrom(CHECK_SOURCE, checkRequest(0, "comment")).ok).toBe(false);
    expect(assistInputFrom(CHECK_SOURCE, checkRequest(0, "check")).ok).toBe(false);
  });

  it("rejects a step that is not in the review", () => {
    const request = checkRequest(0);
    const target = { ...request.target, stepId: "nope" } as AssistRequest["target"];
    expect(assistInputFrom(CHECK_SOURCE, { ...request, target })).toEqual({
      ok: false,
      error: "Unknown step",
    });
  });

  it("rejects a file that is not part of the step", () => {
    const request = checkRequest(0);
    const target = { ...request.target, path: "src/gone.ts" } as AssistRequest["target"];
    expect(assistInputFrom(CHECK_SOURCE, { ...request, target })).toEqual({
      ok: false,
      error: "That file is not in this step",
    });
  });

  it("asks the reviewer to open the step again when its explanation is not cached", () => {
    const uncached = { ...CHECK_SOURCE, explanationOf: () => null };
    expect(assistInputFrom(uncached, checkRequest(0))).toEqual({
      ok: false,
      error: "Open the step again to get its explanation",
    });
  });

  it("rejects a check index the explanation does not have", () => {
    expect(assistInputFrom(CHECK_SOURCE, checkRequest(1))).toEqual({
      ok: false,
      error: "That check is not in the step explanation",
    });
  });
});

describe("AssistRequestSchema check target", () => {
  const checkTarget = (check: number) => ({
    ...checkRequest(0),
    target: { kind: "check", stepId: "s", check, path: "src/a.ts" },
  });

  it("accepts a check index", () => {
    expect(AssistRequestSchema.safeParse(checkTarget(0)).success).toBe(true);
  });

  it("rejects a negative or fractional check index", () => {
    expect(AssistRequestSchema.safeParse(checkTarget(-1)).success).toBe(false);
    expect(AssistRequestSchema.safeParse(checkTarget(1.5)).success).toBe(false);
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
