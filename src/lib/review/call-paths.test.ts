import { describe, expect, it, vi } from "vitest";
import type { Reference } from "@/lib/symbols/symbol-index";
import type { SymbolDefinition } from "@/lib/types";
import { callPathsTo, type CallPath } from "./call-paths";

function definition(name: string, path: string, line: number, endLine: number): SymbolDefinition {
  return { name, kind: "function", path, line, endLine };
}

const PANEL = definition("Panel", "src/panel.tsx", 1, 10);
const PAGE = definition("Page", "src/page.tsx", 3, 12);
const ROUTES = definition("routes", "src/routes.tsx", 5, 20);
const SETTINGS = definition("Settings", "src/settings.tsx", 1, 9);

const DEFINITIONS: Record<string, SymbolDefinition[]> = {
  "src/panel.tsx": [PANEL],
  "src/page.tsx": [PAGE],
  "src/routes.tsx": [ROUTES],
  "src/settings.tsx": [SETTINGS],
};

function use(path: string, line: number, text: string): Reference {
  return { path, line, text };
}

function fakeIndex(references: Record<string, Reference[]>) {
  const referencesOf = vi.fn(async (name: string) => references[name] ?? []);
  const index = { definitionsIn: (path: string) => DEFINITIONS[path] ?? [] };
  return { index, referencesOf };
}

function describePaths(paths: CallPath[]): string[] {
  return paths.map(
    (path) =>
      `${path.end}: ${path.steps.map((step) => `${step.name}@${step.call.path}:${step.call.line}`).join(" > ")}`,
  );
}

describe("callPathsTo", () => {
  it("follows callers of callers up to an entry point, outermost first", async () => {
    const { index, referencesOf } = fakeIndex({
      Panel: [
        use("src/page.tsx", 1, "import { Panel } from './panel';"),
        use("src/page.tsx", 6, "<Panel title='x' />"),
      ],
      Page: [use("src/routes.tsx", 8, "{ path: '/', element: <Page /> },")],
    });

    expect(describePaths(await callPathsTo(index, PANEL, referencesOf))).toEqual([
      "entry: routes@src/routes.tsx:8 > Page@src/page.tsx:6",
    ]);
  });

  it("lists every branch when several places call it", async () => {
    const { index, referencesOf } = fakeIndex({
      Panel: [use("src/page.tsx", 6, "<Panel />"), use("src/settings.tsx", 4, "<Panel />")],
    });

    expect(describePaths(await callPathsTo(index, PANEL, referencesOf))).toEqual([
      "entry: Page@src/page.tsx:6",
      "entry: Settings@src/settings.tsx:4",
    ]);
  });

  it("follows only production code, not tests or files that are not code", async () => {
    const { index, referencesOf } = fakeIndex({
      Panel: [
        use("src/panel.test.tsx", 9, "render(<Panel />);"),
        use("src/app/globals.css", 3, ".panel { color: red; }"),
        use("src/page.tsx", 6, "<Panel />"),
      ],
    });

    expect(describePaths(await callPathsTo(index, PANEL, referencesOf))).toEqual([
      "entry: Page@src/page.tsx:6",
    ]);
  });

  it("treats a use outside any declaration as the top of the path", async () => {
    const { index, referencesOf } = fakeIndex({
      Panel: [use("src/main.tsx", 3, "render(<Panel />);")],
    });

    expect(describePaths(await callPathsTo(index, PANEL, referencesOf))).toEqual([
      "entry: (top level)@src/main.tsx:3",
    ]);
  });

  it("says nothing calls it when there are no callers", async () => {
    const { index, referencesOf } = fakeIndex({});

    expect(describePaths(await callPathsTo(index, PANEL, referencesOf))).toEqual(["entry: "]);
  });

  it("stops at a cycle and at the depth limit instead of looping", async () => {
    const { index, referencesOf } = fakeIndex({
      Panel: [use("src/page.tsx", 6, "Panel()")],
      Page: [use("src/routes.tsx", 8, "Page()")],
      routes: [use("src/settings.tsx", 2, "routes()")],
      Settings: [use("src/page.tsx", 4, "Settings()")],
    });

    expect(describePaths(await callPathsTo(index, PANEL, referencesOf))).toEqual([
      "more: Settings@src/settings.tsx:2 > routes@src/routes.tsx:8 > Page@src/page.tsx:6",
    ]);
  });
});
