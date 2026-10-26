import { describe, expect, it } from "vitest";
import { hoverSummary } from "./hover-summary";

const fenced = (language: string, code: string) => `\`\`\`${language}\n${code}\n\`\`\``;

describe("hoverSummary", () => {
  it.each([
    [fenced("typescript", "(parameter) id: string"), "parameter"],
    [fenced("typescript", "const total: number"), "constant"],
    [fenced("typescript", "let count: number"), "variable"],
    [fenced("typescript", "function load(id: string): string"), "function"],
    [fenced("typescript", "(method) Store.get(): void"), "method"],
    [fenced("typescript", "(property) Store.size: number"), "property"],
    [fenced("typescript", "(alias) function load(id: string): string\nimport load"), "function"],
    [fenced("typescript", 'import fs from "node:fs"'), "module"],
    [fenced("typescript", "interface Options"), "interface"],
    [fenced("typescript", "type Id = string"), "type"],
    [fenced("go", "func Load(id string) error"), "function"],
    [fenced("go", "field Name string"), "property"],
    [fenced("python", "(function) def load(id: str) -> str"), "function"],
    [fenced("python", "(variable) total: int"), "variable"],
    [
      `${fenced("rust", "my_crate::store")}\n\n${fenced("rust", "pub fn load(id: &str)")}`,
      "function",
    ],
    [fenced("rust", "pub struct Store"), "class"],
  ])("reads the kind of %j", (hover, kind) => {
    expect(hoverSummary(hover).kind).toBe(kind);
  });

  it("uses the declaration line as the signature, not the docs", () => {
    const hover = `${fenced("rust", "my_crate::store")}\n\n${fenced("rust", "pub fn load(id: &str)")}\n\n---\n\nLoads it.`;
    expect(hoverSummary(hover).signature).toBe("pub fn load(id: &str)");
    expect(hoverSummary("plain words only").signature).toBe("plain words only");
  });
});
