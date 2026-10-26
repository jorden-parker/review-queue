import { describe, expect, it } from "vitest";
import type { DefinitionWithCode } from "@/lib/review/peek-code";
import type { ContextSymbol } from "@/lib/session/store";
import {
  ALL_KIND_GROUPS,
  contextCount,
  isPinned,
  peekedSymbol,
  seenSymbolOf,
  visibleSymbols,
  withSymbol,
} from "./context-symbols";

const ORIGIN = { name: "load", path: "src/b.ts", line: 2, character: 4, side: "new" as const };

function symbol(overrides: Partial<ContextSymbol>): ContextSymbol {
  return {
    name: "load",
    kind: "function",
    path: "src/a.ts",
    line: 1,
    scope: "repo",
    signature: "function load()",
    stepId: "s1",
    pinned: false,
    seenAt: "2026-10-26T10:00:00.000Z",
    origin: ORIGIN,
    ...overrides,
  };
}

const SYMBOLS = [
  symbol({ name: "total", kind: "constant", line: 9, stepId: "s2" }),
  symbol({ name: "Options", kind: "type", line: 4, stepId: "s1" }),
  symbol({ name: "load", pinned: true, stepId: "s3" }),
  symbol({ name: "console", kind: "variable", scope: "external", stepId: "s2" }),
];

const names = (symbols: ContextSymbol[]) => symbols.map((entry) => entry.name);

describe("visibleSymbols", () => {
  it("lists pinned symbols first, then the rest newest first", () => {
    const all = visibleSymbols(SYMBOLS, "s2", { view: "all", shown: ALL_KIND_GROUPS });
    expect(names(all)).toEqual(["load", "total", "Options", "console"]);
  });

  it("narrows to pins or to the current step", () => {
    expect(
      names(visibleSymbols(SYMBOLS, "s2", { view: "pinned", shown: ALL_KIND_GROUPS })),
    ).toEqual(["load"]);
    expect(names(visibleSymbols(SYMBOLS, "s2", { view: "step", shown: ALL_KIND_GROUPS }))).toEqual([
      "total",
      "console",
    ]);
  });

  it("hides kinds that are toggled off, with library symbols as their own group", () => {
    const shown = visibleSymbols(SYMBOLS, "s2", { view: "all", shown: ["functions", "values"] });
    expect(names(shown)).toEqual(["load", "total"]);
  });
});

describe("contextCount", () => {
  it("counts pins plus this step's symbols once each", () => {
    expect(contextCount(SYMBOLS, "s2")).toBe(3);
    expect(contextCount(SYMBOLS, "s3")).toBe(1);
  });
});

describe("withSymbol", () => {
  it("moves a revisited symbol to the top and keeps its pin", () => {
    const updated = withSymbol(SYMBOLS, { ...SYMBOLS[2], stepId: "s1" }, {});
    expect(names(updated)[0]).toBe("load");
    expect(updated[0]).toMatchObject({ pinned: true, stepId: "s1" });
    expect(updated).toHaveLength(4);
  });

  it("adds a new symbol and can change its pin", () => {
    const added = withSymbol(SYMBOLS, symbol({ name: "fresh", line: 30 }), { pinned: true });
    expect(added[0]).toMatchObject({ name: "fresh", pinned: true });
  });
});

describe("isPinned", () => {
  it("matches a symbol by name and location", () => {
    expect(isPinned(SYMBOLS, SYMBOLS[2])).toBe(true);
    expect(isPinned(SYMBOLS, SYMBOLS[0])).toBe(false);
    expect(isPinned(SYMBOLS, { ...SYMBOLS[2], line: 99 })).toBe(false);
  });
});

describe("peekedSymbol", () => {
  it("is the first definition of a resolved peek, or null", () => {
    const definition = {
      ...SYMBOLS[1],
      endLine: 4,
      lines: [],
      tokens: [],
      source: "index",
      hover: null,
    } satisfies DefinitionWithCode & { pinned: boolean };
    const peek = {
      position: ORIGIN,
      tab: "definitions" as const,
      definitions: [definition],
      references: null,
      error: null,
    };
    expect(peekedSymbol(peek, "s9")).toMatchObject({
      name: "Options",
      stepId: "s9",
      origin: ORIGIN,
    });
    expect(peekedSymbol({ ...peek, definitions: null }, "s9")).toBeNull();
    expect(peekedSymbol(null, "s9")).toBeNull();
  });
});

describe("seenSymbolOf", () => {
  it("takes what the Context tab needs from a peeked definition", () => {
    const definition = {
      name: "total",
      kind: "constant",
      path: "src/a.ts",
      line: 3,
      endLine: 3,
      lines: ["const total = 1;"],
      tokens: [],
      source: "lsp",
      scope: "file",
      signature: "const total: number",
      hover: null,
    } satisfies DefinitionWithCode;
    expect(seenSymbolOf(definition, ORIGIN, "s1")).toEqual({
      name: "total",
      kind: "constant",
      path: "src/a.ts",
      line: 3,
      scope: "file",
      signature: "const total: number",
      stepId: "s1",
      origin: ORIGIN,
    });
  });
});
