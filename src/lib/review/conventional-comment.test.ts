import { describe, expect, it } from "vitest";
import {
  conventionalLabel,
  exclusiveDecorations,
  hasConsistentDecorations,
  isBlocking,
  splitConventionalPrefix,
  unwrappedDraft,
} from "./conventional-comment";

describe("conventionalLabel", () => {
  it("returns the bare label when there are no decorations", () => {
    expect(conventionalLabel({ kind: "question", decorations: [] })).toBe("question");
  });

  it("joins decorations in parentheses without a space", () => {
    expect(conventionalLabel({ kind: "issue", decorations: ["blocking", "if-minor"] })).toBe(
      "issue (blocking,if-minor)",
    );
  });

  it("calls a parked aside an aside", () => {
    expect(conventionalLabel({ kind: "parked", decorations: [] })).toBe("aside");
  });
});

describe("isBlocking", () => {
  it("is true when the blocking decoration is present", () => {
    expect(isBlocking({ kind: "issue", decorations: ["blocking"] })).toBe(true);
  });

  it("is false without the blocking decoration", () => {
    expect(isBlocking({ kind: "issue", decorations: ["non-blocking"] })).toBe(false);
  });
});

describe("exclusiveDecorations", () => {
  it("drops non-blocking when blocking is newly added", () => {
    expect(exclusiveDecorations(["non-blocking"], ["non-blocking", "blocking"])).toEqual([
      "blocking",
    ]);
  });

  it("drops blocking when non-blocking is newly added", () => {
    expect(exclusiveDecorations(["blocking"], ["blocking", "non-blocking"])).toEqual([
      "non-blocking",
    ]);
  });

  it("keeps other decorations when one is added", () => {
    expect(exclusiveDecorations(["blocking"], ["blocking", "if-minor"])).toEqual([
      "blocking",
      "if-minor",
    ]);
  });

  it("passes removals through", () => {
    expect(exclusiveDecorations(["blocking", "if-minor"], ["if-minor"])).toEqual(["if-minor"]);
  });

  it("returns decorations in canonical order", () => {
    expect(exclusiveDecorations([], ["if-minor", "blocking"])).toEqual(["blocking", "if-minor"]);
  });
});

describe("hasConsistentDecorations", () => {
  it("rejects blocking together with non-blocking", () => {
    expect(hasConsistentDecorations(["blocking", "non-blocking"])).toBe(false);
  });

  it("rejects a repeated decoration", () => {
    expect(hasConsistentDecorations(["if-minor", "if-minor"])).toBe(false);
  });

  it("accepts blocking with if-minor", () => {
    expect(hasConsistentDecorations(["blocking", "if-minor"])).toBe(true);
  });
});

describe("splitConventionalPrefix", () => {
  it.each([
    ["**question:** why?", { kind: "question", decorations: [] }, "why?"],
    ["Suggestion: use map", { kind: "suggestion", decorations: [] }, "use map"],
    ["**issue (blocking):** leaks", { kind: "issue", decorations: ["blocking"] }, "leaks"],
    [
      "nitpick (non-blocking, if-minor): x",
      { kind: "nitpick", decorations: ["non-blocking", "if-minor"] },
      "x",
    ],
    ["**suggestion**: use map", { kind: "suggestion", decorations: [] }, "use map"],
    [
      "**suggestion:**\n\n```ts\na()\n```",
      { kind: "suggestion", decorations: [] },
      "```ts\na()\n```",
    ],
    ["**issue (urgent):** x", { kind: "issue", decorations: [] }, "x"],
    ["**issue (blocking, non-blocking):** x", { kind: "issue", decorations: ["blocking"] }, "x"],
  ])("reads the label from %j", (text, tag, body) => {
    expect(splitConventionalPrefix(text)).toEqual({ tag, body });
  });

  it.each(["Note that this is fine", "bug: x", "Notes: x", "aside: x"])(
    "leaves %j alone when it has no known label",
    (text) => {
      expect(splitConventionalPrefix(text)).toEqual({ tag: null, body: text });
    },
  );
});

describe("unwrappedDraft", () => {
  const wrappedDraft =
    "`suggestion: Add a test for an empty stream. Include a test case like: `const response = new Response(null, { status: 204 }); expect(response.body).toBeNull();` to confirm no progress is reported.`";

  it("removes a single-backtick wrapper that holds a labelled comment", () => {
    const draft = unwrappedDraft(wrappedDraft);
    expect(draft.startsWith("suggestion: Add a test")).toBe(true);
    expect(draft).toContain(
      "`const response = new Response(null, { status: 204 }); expect(response.body).toBeNull();`",
    );
  });

  it.each([
    ["```\nnitpick: x\n```", "nitpick: x"],
    ["```ts\nnitpick: x\n```", "nitpick: x"],
    ["`suggestion: use `map``", "suggestion: use `map`"],
    ["  `question: why?`  ", "question: why?"],
  ])("unwraps %j to %j", (text, expected) => {
    expect(unwrappedDraft(text)).toBe(expected);
  });

  it.each(["`foo` and `bar`", "`code` only", "plain text", "```ts\na()\n```\nnitpick: x"])(
    "leaves %j unchanged",
    (text) => {
      expect(unwrappedDraft(text)).toBe(text);
    },
  );
});
