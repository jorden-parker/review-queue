import { describe, expect, it } from "vitest";
import type { SymbolDefinition, SymbolKind } from "@/lib/types";
import { outlineOf } from "./outline";

function symbol(name: string, kind: SymbolKind, line: number, endLine: number): SymbolDefinition {
  return { name, kind, path: "src/store.ts", line, endLine };
}

function names(tree: ReturnType<typeof outlineOf>): unknown[] {
  return tree.map((node) =>
    node.children.length > 0 ? [node.name, names(node.children)] : node.name,
  );
}

describe("outlineOf", () => {
  it("nests symbols under the innermost symbol whose range contains them", () => {
    const tree = outlineOf([
      symbol("Store", "class", 3, 20),
      symbol("load", "method", 5, 10),
      symbol("cached", "variable", 6, 6),
      symbol("save", "method", 12, 18),
      symbol("helper", "function", 22, 25),
    ]);
    expect(names(tree)).toEqual([["Store", [["load", ["cached"]], "save"]], "helper"]);
  });

  it("orders siblings by line whatever order they arrive in", () => {
    const tree = outlineOf([symbol("later", "function", 9, 9), symbol("first", "function", 1, 2)]);
    expect(names(tree)).toEqual(["first", "later"]);
  });

  it("puts the wider symbol first when two start on the same line", () => {
    const tree = outlineOf([symbol("inner", "variable", 4, 4), symbol("outer", "function", 4, 8)]);
    expect(names(tree)).toEqual([["outer", ["inner"]]]);
  });

  it("leaves out parameters", () => {
    const tree = outlineOf([symbol("run", "function", 1, 5), symbol("load", "parameter", 1, 1)]);
    expect(names(tree)).toEqual(["run"]);
  });
});
