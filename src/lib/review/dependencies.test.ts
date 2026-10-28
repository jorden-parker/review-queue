import { describe, expect, it } from "vitest";
import type { SymbolDefinition } from "@/lib/types";
import { dependenciesOf } from "./dependencies";

function definition(
  name: string,
  kind: SymbolDefinition["kind"],
  path: string,
  line: number,
  endLine = line,
): SymbolDefinition {
  return { name, kind, path, line, endLine };
}

const FILES: Record<string, string[]> = {
  "src/panel.tsx": [
    "import { formatTitle } from './format';",
    "import type { PanelProps } from './types';",
    "import { Card } from './card';",
    "export function Panel({ title }: PanelProps) {",
    "  const heading = formatTitle(title);",
    "  props.render();",
    "  return <Card heading={heading} className={sans} />;",
    "}",
  ],
  "src/format.ts": ["export function formatTitle(text: string): string {", "  return text;", "}"],
  "src/types.ts": ["export type PanelProps = {", "  title: string;", "};"],
  "src/card.tsx": ["export function Card() {}"],
  "src/other.ts": ["class Other {", "  render() {}", "}"],
  "src/layout.ts": ["const sans = font();"],
};

const PANEL = definition("Panel", "function", "src/panel.tsx", 4, 8);

const DEFINITIONS: SymbolDefinition[] = [
  PANEL,
  definition("title", "parameter", "src/panel.tsx", 4),
  definition("heading", "constant", "src/panel.tsx", 5),
  definition("formatTitle", "function", "src/format.ts", 1, 3),
  definition("text", "parameter", "src/format.ts", 1),
  definition("PanelProps", "type", "src/types.ts", 1, 3),
  definition("Card", "function", "src/card.tsx", 1),
  definition("Other", "class", "src/other.ts", 1, 3),
  definition("render", "method", "src/other.ts", 2),
  definition("sans", "constant", "src/layout.ts", 1),
];

const INDEX = {
  definitionsIn: (path: string) => DEFINITIONS.filter((candidate) => candidate.path === path),
  definitionsOf: (name: string) => DEFINITIONS.filter((candidate) => candidate.name === name),
  readLines: (path: string, start: number, end: number) =>
    (FILES[path] ?? []).slice(start - 1, end),
};

describe("dependenciesOf", () => {
  it("finds the functions, components and types it uses from elsewhere, with their code", () => {
    const dependencies = dependenciesOf(INDEX, PANEL);

    expect(dependencies.map((dependency) => dependency.name)).toEqual([
      "PanelProps",
      "formatTitle",
      "Card",
    ]);
    expect(dependencies[0]?.code).toEqual([
      { line: 1, text: "export type PanelProps = {" },
      { line: 2, text: "  title: string;" },
      { line: 3, text: "};" },
    ]);
  });

  it("leaves out its own locals, parameters, property accesses and itself", () => {
    const names = dependenciesOf(INDEX, PANEL).map((dependency) => dependency.name);

    expect(names).not.toContain("title");
    expect(names).not.toContain("heading");
    expect(names).not.toContain("render");
    expect(names).not.toContain("Panel");
  });

  it("leaves out names the file neither imports nor declares", () => {
    const names = dependenciesOf(INDEX, PANEL).map((dependency) => dependency.name);

    expect(names).not.toContain("sans");
  });
});
