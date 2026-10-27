import { describe, expect, it } from "vitest";
import {
  conventionalLabel,
  exclusiveDecorations,
  hasConsistentDecorations,
  isBlocking,
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
