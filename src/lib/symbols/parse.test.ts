import { describe, expect, it } from "vitest";
import { supportedSpecs } from "./languages";
import { compiledFor, parseDefinitions } from "./parse";

function summary(definitions: { name: string; kind: string; line: number }[]) {
  return definitions.map(
    (definition) => `${definition.kind} ${definition.name}@${definition.line}`,
  );
}

describe("parseDefinitions", () => {
  it("compiles the definition query for every grammar", async () => {
    for (const spec of supportedSpecs()) {
      await expect(compiledFor(spec)).resolves.toBeDefined();
    }
  });

  it("finds TypeScript definitions", async () => {
    const source = [
      "export function load(id: string) {}",
      "export const parse = (raw: string) => raw;",
      "export const LIMIT = 5;",
      "interface Item { id: string }",
      "type Id = string;",
      "export class Cache {",
      "  get(key: string) {}",
      "}",
    ].join("\n");
    expect(summary(await parseDefinitions("src/a.ts", source))).toEqual([
      "function load@1",
      "function parse@2",
      "constant LIMIT@3",
      "interface Item@4",
      "type Id@5",
      "class Cache@6",
      "method get@7",
    ]);
  });

  it("finds Go definitions with their extent", async () => {
    const source =
      "package a\n\ntype Store struct{}\n\nfunc (s *Store) Get() {\n}\n\nfunc New() *Store {\n\treturn nil\n}\n";
    const definitions = await parseDefinitions("a.go", source);
    expect(summary(definitions)).toEqual(["type Store@3", "method Get@5", "function New@8"]);
    expect(definitions[2].endLine).toBe(10);
  });

  it("finds Python definitions", async () => {
    const source = "MAX = 3\n\nclass Repo:\n    def save(self):\n        pass\n";
    expect(summary(await parseDefinitions("a.py", source))).toEqual([
      "variable MAX@1",
      "class Repo@3",
      "function save@4",
    ]);
  });

  it("ignores unsupported files", async () => {
    expect(await parseDefinitions("README.md", "# hi")).toEqual([]);
  });
});
