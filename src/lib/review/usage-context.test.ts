import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ensureCheckout } from "@/lib/git/checkout";
import { type Reference, SymbolIndex } from "@/lib/symbols/symbol-index";
import type { SymbolDefinition } from "@/lib/types";
import {
  createFixtureRepo,
  type FixtureRepo,
  headOf,
  mainOf,
  removeFixtureRepo,
} from "@/test/git-fixture";
import { usageContext, usageText, type UsageIndex } from "./usage-context";

const PATH = "src/user.ts";

function definition(
  name: string,
  kind: SymbolDefinition["kind"],
  line: number,
  endLine = line,
  path = PATH,
): SymbolDefinition {
  return { name, kind, path, line, endLine };
}

const IN_FILE: SymbolDefinition[] = [
  definition("fetchUser", "function", 10, 20),
  definition("id", "parameter", 10),
  definition("cached", "variable", 12),
  definition("User", "class", 30, 40),
  definition("render", "method", 32, 35),
  definition("LIMIT", "constant", 50),
];

function fakeIndex(
  references: Record<string, Reference[]>,
  elsewhere: SymbolDefinition[] = [],
): UsageIndex {
  return {
    definitionsIn: () => IN_FILE,
    definitionsOf: (name) => [
      ...IN_FILE.filter((candidate) => candidate.name === name),
      ...elsewhere.filter((candidate) => candidate.name === name),
    ],
    referencesTo: vi.fn(async (name: string) => references[name] ?? []),
    readLines: () => [],
  };
}

const lines = (...numbers: number[]) => new Set(numbers);

describe("usageContext", () => {
  it("covers only declarations on the target lines, leaving out parameters and locals", async () => {
    const usages = await usageContext(fakeIndex({}), PATH, lines(10, 12, 32, 50));

    expect(usages.map((usage) => usage.name)).toEqual(["fetchUser", "render", "LIMIT"]);
  });

  it("drops the declaration's own lines from its uses", async () => {
    const index = fakeIndex({
      fetchUser: [
        { path: PATH, line: 10, text: "export function fetchUser(id) {" },
        { path: PATH, line: 15, text: "return fetchUser(id - 1);" },
        { path: "src/page.ts", line: 4, text: "const user = await fetchUser(id);" },
        { path: PATH, line: 60, text: "fetchUser(1);" },
      ],
    });
    const [usage] = await usageContext(index, PATH, lines(10));

    expect(usage?.uses).toMatchObject([
      { path: "src/page.ts", line: 4, text: "const user = await fetchUser(id);" },
      { path: PATH, line: 60, text: "fetchUser(1);" },
    ]);
    expect(usage?.useCount).toBe(2);
  });

  it("lists same-named definitions elsewhere, but not methods that only share a name", async () => {
    const index = fakeIndex({}, [
      definition("fetchUser", "function", 8, 18, "src/legacy/user.ts"),
      definition("render", "method", 3, 9, "src/other.ts"),
    ]);
    const usages = await usageContext(index, PATH, lines(10, 32));

    expect(usages.map((usage) => usage.otherDefinitions)).toEqual([
      [definition("fetchUser", "function", 8, 18, "src/legacy/user.ts")],
      [],
    ]);
  });

  it("caps the uses it keeps but counts them all", async () => {
    const many = Array.from({ length: 20 }, (_, index) => ({
      path: "src/page.ts",
      line: index + 1,
      text: "LIMIT",
    }));
    const [usage] = await usageContext(fakeIndex({ LIMIT: many }), PATH, lines(50));

    expect(usage?.uses).toHaveLength(8);
    expect(usage?.useCount).toBe(20);
  });

  it("finds nothing when no declaration sits on the target lines", async () => {
    expect(await usageContext(fakeIndex({}), PATH, lines(99))).toEqual([]);
  });
});

describe("usageText", () => {
  it("shows each declaration's uses and other definitions, and says when nothing uses it", async () => {
    const index = fakeIndex(
      { fetchUser: [{ path: "src/page.ts", line: 4, text: "  await fetchUser(id);" }] },
      [definition("LIMIT", "constant", 2, 2, "src/config.ts")],
    );
    const text = usageText(await usageContext(index, PATH, lines(10, 50)));

    expect(text).toBe(
      [
        "fetchUser (function) src/user.ts:10-20, 1 use elsewhere",
        "  src/page.ts:4: await fetchUser(id);",
        "LIMIT (constant) src/user.ts:50-50, no uses outside its own definition",
        "  Also defined at: src/config.ts:2 (constant)",
      ].join("\n"),
    );
  });
});

describe("usageContext over a real checkout", () => {
  const REF = { owner: "acme", repo: "app", number: 1 };
  let fixture: FixtureRepo;
  let index: SymbolIndex;

  beforeEach(async () => {
    fixture = createFixtureRepo(
      {
        "src/page.ts":
          "import { fetchUser } from './user';\nexport const page = () => fetchUser('1');\n",
        "src/legacy.ts": "export function fetchUser(id: string) {\n  return id;\n}\n",
      },
      {
        "src/user.ts": [
          "export function fetchUser(id: string) {",
          "  const cached = id.trim();",
          "  return cached;",
          "}",
          "export const LIMIT = 3;",
        ].join("\n"),
      },
      REF.number,
    );
    const checkout = await ensureCheckout(
      REF,
      { baseBranch: "main", baseSha: mainOf(fixture), headSha: headOf(fixture, REF.number) },
      { cacheRoot: fixture.cacheRoot, remoteUrl: fixture.origin },
    );
    index = await SymbolIndex.build(checkout.worktreePath, checkout.run);
  });

  afterEach(() => removeFixtureRepo(fixture));

  it("finds callers in other files, duplicates and unused declarations", async () => {
    const text = usageText(await usageContext(index, "src/user.ts", new Set([1, 2, 3, 4, 5])));

    expect(text).toContain("fetchUser (function) src/user.ts:1-4, 3 uses elsewhere");
    expect(text).toContain(
      "src/page.ts:2 in page:\n    1: import { fetchUser } from './user';\n    2: export const page = () => fetchUser('1');",
    );
    expect(text).toContain("Also defined at: src/legacy.ts:1 (function)");
    expect(text).toContain("LIMIT (constant) src/user.ts:5-5, no uses outside its own definition");
    expect(text).not.toContain("cached (");
  });
});

describe("usageContext for a component changed inside its body", () => {
  const REF = { owner: "acme", repo: "app", number: 1 };
  let fixture: FixtureRepo;
  let index: SymbolIndex;

  beforeEach(async () => {
    fixture = createFixtureRepo(
      {
        "src/page.tsx": [
          "import { Panel } from './panel';",
          "",
          "export function Page() {",
          "  return (",
          "    <Panel",
          '      title="Hi"',
          "      onClose={() => {}}",
          "    />",
          "  );",
          "}",
        ].join("\n"),
      },
      {
        "src/panel.tsx": [
          "export function Panel({ title }: { title: string }) {",
          "  const heading = title.toUpperCase();",
          "  return <h1>{heading}</h1>;",
          "}",
        ].join("\n"),
      },
      REF.number,
    );
    const checkout = await ensureCheckout(
      REF,
      { baseBranch: "main", baseSha: mainOf(fixture), headSha: headOf(fixture, REF.number) },
      { cacheRoot: fixture.cacheRoot, remoteUrl: fixture.origin },
    );
    index = await SymbolIndex.build(checkout.worktreePath, checkout.run);
  });

  afterEach(() => removeFixtureRepo(fixture));

  it("covers the component that encloses the changed lines", async () => {
    const usages = await usageContext(index, "src/panel.tsx", new Set([3]));

    expect(usages.map((usage) => usage.name)).toEqual(["Panel"]);
  });

  it("shows the calling component's code around each use, not just the matching line", async () => {
    const text = usageText(await usageContext(index, "src/panel.tsx", new Set([3])));

    expect(text).toContain("src/page.tsx:5 in Page:");
    expect(text).toContain('      title="Hi"');
    expect(text).toContain("      onClose={() => {}}");
  });
});
