import { describe, expect, it } from "vitest";
import type { DefinitionWithCode, ReferenceWithCode } from "@/lib/review/peek-code";
import type { SymbolPosition } from "@/lib/types";
import { occurrenceAt, occurrencesOf } from "./occurrences";
import type { PeekState } from "./use-peek";

const clicked: SymbolPosition = {
  name: "format",
  path: "src/a.ts",
  line: 4,
  character: 2,
  side: "new",
};

function peekWith(overrides: Partial<PeekState>): PeekState {
  return {
    position: clicked,
    tab: "definitions",
    definitions: null,
    references: null,
    error: null,
    ...overrides,
  };
}

function definitionAt(path: string, line: number): DefinitionWithCode {
  return {
    name: "format",
    kind: "function",
    path,
    line,
    endLine: line,
    lines: [],
    tokens: [],
    source: "index",
    scope: "repo",
    signature: "",
    hover: null,
  };
}

function referenceAt(path: string, line: number): ReferenceWithCode {
  return { path, line, text: "format()", tokens: [] };
}

describe("occurrencesOf", () => {
  it("is null without a peek", () => {
    expect(occurrencesOf(null)).toBeNull();
  });

  it("marks the clicked line as a reference before any results arrive", () => {
    const occurrences = occurrencesOf(peekWith({}));
    expect(occurrences?.name).toBe("format");
    expect(occurrenceAt(occurrences, "src/a.ts", 4)).toBe("reference");
  });

  it("marks every reference line as a reference", () => {
    const occurrences = occurrencesOf(
      peekWith({ references: [referenceAt("src/a.ts", 9), referenceAt("src/b.ts", 2)] }),
    );
    expect(occurrenceAt(occurrences, "src/a.ts", 9)).toBe("reference");
    expect(occurrenceAt(occurrences, "src/b.ts", 2)).toBe("reference");
  });

  it("marks every definition line as a definition", () => {
    const occurrences = occurrencesOf(
      peekWith({ definitions: [definitionAt("src/format.ts", 12)] }),
    );
    expect(occurrenceAt(occurrences, "src/format.ts", 12)).toBe("definition");
  });

  it("lets a definition win over a reference on the same line", () => {
    const occurrences = occurrencesOf(
      peekWith({
        definitions: [definitionAt("src/a.ts", 4)],
        references: [referenceAt("src/a.ts", 4)],
      }),
    );
    expect(occurrenceAt(occurrences, "src/a.ts", 4)).toBe("definition");
  });
});

describe("occurrenceAt", () => {
  it("is null for lines that are not occurrences", () => {
    const occurrences = occurrencesOf(peekWith({}));
    expect(occurrenceAt(occurrences, "src/a.ts", 5)).toBeNull();
    expect(occurrenceAt(occurrences, "src/other.ts", 4)).toBeNull();
  });

  it("is null for deleted lines that have no new-side number", () => {
    const occurrences = occurrencesOf(peekWith({}));
    expect(occurrenceAt(occurrences, "src/a.ts", null)).toBeNull();
  });

  it("is null when there are no occurrences", () => {
    expect(occurrenceAt(null, "src/a.ts", 4)).toBeNull();
  });
});
