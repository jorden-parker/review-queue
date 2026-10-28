import { describe, expect, it, vi } from "vitest";
import type { LanguageClient, ServerLocation } from "@/lib/lsp/client";
import type { SymbolPosition } from "@/lib/types";
import { definitionsAt, referencesAt, type Navigation } from "./navigation";

const ROOT = "/checkout";
const FILES: Record<string, string[]> = {
  "src/app.ts": ["export function run(load: number) {", "  return load + 1;", "}"],
  "src/store.ts": ["export function load() {}"],
  "src/view.ts": ["import { load } from '@acme/store';", "export const shown = load();"],
  "src/wide.ts": ["import {", "  load,", "} from './store';", "export const open = load();"],
  "packages/store/src/index.ts": ["export function load() {}"],
  "lib/other/store.ts": ["export function load() {}"],
};

const POSITION: SymbolPosition = {
  name: "load",
  path: "src/app.ts",
  line: 2,
  character: 9,
  side: "new",
};

const VIEW_POSITION: SymbolPosition = { ...POSITION, path: "src/view.ts", line: 2, character: 21 };

function stubIndex(): Navigation["index"] {
  return {
    definitionsOf: () => [
      { name: "load", kind: "function", path: "src/store.ts", line: 1, endLine: 1 },
    ],
    readLines: (file, start, end) => FILES[file].slice(start - 1, end),
    referencesTo: async () => [
      { path: "src/store.ts", line: 1, text: "export function load() {}" },
    ],
    filesMentioning: async () => ["src/store.ts", "test/store.ts"],
    relativePath: (absolute) =>
      absolute.startsWith(`${ROOT}/`) ? absolute.slice(ROOT.length + 1) : null,
    linkedPackageDirectory: (name) => (name === "@acme/store" ? "packages/store" : null),
  };
}

function stubClient(overrides: Partial<Record<keyof LanguageClient, unknown>>) {
  return {
    definition: vi.fn(async (): Promise<ServerLocation[]> => []),
    references: vi.fn(async (): Promise<ServerLocation[]> => []),
    hover: vi.fn(async () => null),
    ...overrides,
  } as unknown as LanguageClient;
}

function navigationWith(client: LanguageClient | null) {
  return { index: stubIndex(), clientFor: async () => client };
}

describe("definitionsAt", () => {
  it("uses the language server's answer at the exact position", async () => {
    const client = stubClient({
      definition: async () => [
        { file: `${ROOT}/src/app.ts`, line: 1, character: 20, endLine: 1, declarationLine: 1 },
      ],
      hover: async () => "```typescript\n(parameter) load: number\n```",
    });
    const [found] = await definitionsAt(navigationWith(client), POSITION);
    expect(found).toMatchObject({
      path: "src/app.ts",
      line: 1,
      kind: "parameter",
      source: "lsp",
      scope: "file",
      signature: "(parameter) load: number",
    });
    expect(found.lines).toEqual(["export function run(load: number) {"]);
  });

  it("describes library definitions from hover without reading them", async () => {
    const client = stubClient({
      definition: async () => [
        {
          file: "/opt/ts/lib/lib.dom.d.ts",
          line: 30,
          character: 4,
          endLine: 40,
          declarationLine: 30,
        },
      ],
      hover: async () => "```typescript\nvar console: Console\n```",
    });
    const [found] = await definitionsAt(navigationWith(client), { ...POSITION, name: "console" });
    expect(found).toMatchObject({
      path: "lib.dom.d.ts",
      scope: "external",
      lines: [],
      hover: "```typescript\nvar console: Console\n```",
    });
  });

  it("falls back to the name index when the server is missing, empty or failing", async () => {
    const failing = stubClient({
      definition: async () => {
        throw new Error("timed out");
      },
    });
    for (const navigation of [
      navigationWith(null),
      navigationWith(stubClient({})),
      navigationWith(failing),
    ]) {
      const [found] = await definitionsAt(navigation, POSITION);
      expect(found).toMatchObject({ path: "src/store.ts", source: "index", scope: "repo" });
    }
  });

  it("uses the name index for deleted lines, which the head checkout does not have", async () => {
    const clientFor = vi.fn();
    const [found] = await definitionsAt(
      { index: stubIndex(), clientFor },
      { ...POSITION, side: "old" },
    );
    expect(found.source).toBe("index");
    expect(clientFor).not.toHaveBeenCalled();
  });

  it("falls back to the index when the server stops at an import it could not resolve", async () => {
    const client = stubClient({
      definition: async () => [
        { file: `${ROOT}/src/view.ts`, line: 1, character: 9, endLine: 1, declarationLine: 1 },
      ],
      hover: async () => "```typescript\nimport load\n```",
    });
    const [found] = await definitionsAt(navigationWith(client), VIEW_POSITION);
    expect(found).toMatchObject({
      path: "src/store.ts",
      source: "index",
      scope: "repo",
      kind: "function",
    });
  });

  it("recognises a multi-line import from its first line", async () => {
    const client = stubClient({
      definition: async () => [
        { file: `${ROOT}/src/wide.ts`, line: 2, character: 2, endLine: 3, declarationLine: 1 },
      ],
    });
    const [found] = await definitionsAt(navigationWith(client), {
      ...POSITION,
      path: "src/wide.ts",
      line: 4,
      character: 20,
    });
    expect(found).toMatchObject({ path: "src/store.ts", source: "index" });
  });

  it("keeps the server's import answer when the index knows no such name", async () => {
    const client = stubClient({
      definition: async () => [
        { file: `${ROOT}/src/view.ts`, line: 1, character: 9, endLine: 1, declarationLine: 1 },
      ],
      hover: async () => "```typescript\nimport load\n```",
    });
    const index = { ...stubIndex(), definitionsOf: () => [] };
    const [found] = await definitionsAt({ index, clientFor: async () => client }, VIEW_POSITION);
    expect(found).toMatchObject({ path: "src/view.ts", line: 1, source: "lsp", kind: "module" });
  });

  it("puts the index definition inside the imported package first", async () => {
    const client = stubClient({
      definition: async () => [
        { file: `${ROOT}/src/view.ts`, line: 1, character: 9, endLine: 1, declarationLine: 1 },
      ],
    });
    const index: Navigation["index"] = {
      ...stubIndex(),
      definitionsOf: () => [
        { name: "load", kind: "function", path: "src/store.ts", line: 1, endLine: 1 },
        {
          name: "load",
          kind: "function",
          path: "packages/store/src/index.ts",
          line: 1,
          endLine: 1,
        },
      ],
    };
    const found = await definitionsAt({ index, clientFor: async () => client }, VIEW_POSITION);
    expect(found.map((definition) => definition.path)).toEqual([
      "packages/store/src/index.ts",
      "src/store.ts",
    ]);
  });

  it("puts the index definition at a relative import's target first", async () => {
    const client = stubClient({
      definition: async () => [
        { file: `${ROOT}/src/wide.ts`, line: 2, character: 2, endLine: 3, declarationLine: 1 },
      ],
    });
    const index: Navigation["index"] = {
      ...stubIndex(),
      definitionsOf: () => [
        { name: "load", kind: "function", path: "lib/other/store.ts", line: 1, endLine: 1 },
        { name: "load", kind: "function", path: "src/store.ts", line: 1, endLine: 1 },
      ],
    };
    const found = await definitionsAt(
      { index, clientFor: async () => client },
      { ...POSITION, path: "src/wide.ts", line: 4, character: 20 },
    );
    expect(found.map((definition) => definition.path)).toEqual([
      "src/store.ts",
      "lib/other/store.ts",
    ]);
  });
});

describe("referencesAt", () => {
  it("reads server references inside the checkout and drops outside ones", async () => {
    const client = stubClient({
      references: async () => [
        { file: `${ROOT}/src/app.ts`, line: 2, character: 9, endLine: 2, declarationLine: 2 },
        { file: "/opt/elsewhere.ts", line: 1, character: 0, endLine: 1, declarationLine: 1 },
      ],
    });
    const references = await referencesAt(navigationWith(client), POSITION);
    expect(references.map(({ path, line, text }) => ({ path, line, text }))).toEqual([
      { path: "src/app.ts", line: 2, text: "return load + 1;" },
    ]);
  });

  it("lets the server search the files text search finds", async () => {
    const references = vi.fn(async (): Promise<ServerLocation[]> => []);
    await referencesAt(navigationWith(stubClient({ references })), POSITION);
    expect(references).toHaveBeenCalledWith("src/app.ts", 2, 9, ["src/store.ts", "test/store.ts"]);
  });

  it("falls back to text search when the server is missing, empty or failing", async () => {
    const failing = stubClient({
      references: async () => {
        throw new Error("timed out");
      },
    });
    for (const navigation of [
      navigationWith(null),
      navigationWith(stubClient({})),
      navigationWith(failing),
    ]) {
      const [reference] = await referencesAt(navigation, POSITION);
      expect(reference.path).toBe("src/store.ts");
    }
  });

  it("uses text search when the identifier's import did not resolve", async () => {
    const references = vi.fn(async (): Promise<ServerLocation[]> => [
      { file: `${ROOT}/src/view.ts`, line: 2, character: 21, endLine: 2, declarationLine: 2 },
    ]);
    const client = stubClient({
      definition: async () => [
        { file: `${ROOT}/src/view.ts`, line: 1, character: 9, endLine: 1, declarationLine: 1 },
      ],
      references,
    });
    const [reference] = await referencesAt(navigationWith(client), VIEW_POSITION);
    expect(reference.path).toBe("src/store.ts");
    expect(references).not.toHaveBeenCalled();
  });
});
