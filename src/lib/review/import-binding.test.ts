import { describe, expect, it } from "vitest";
import {
  importSourceOf,
  isImportStatement,
  moduleSpecifierOf,
  rankByImportSource,
} from "./import-binding";

describe("isImportStatement", () => {
  it("recognises import, re-export and require statements in every language", () => {
    for (const statement of [
      'import { a } from "./x";',
      'import {\n  a,\n} from "./x";',
      'export { a } from "./x";',
      "from pkg.mod import a",
      "use crate::a;",
      'const { a } = require("./x");',
    ]) {
      expect(isImportStatement(statement)).toBe(true);
    }
  });

  it("rejects declarations and lines that only continue an import", () => {
    for (const statement of ["export function a() {}", "  a,", "const a = 1;"]) {
      expect(isImportStatement(statement)).toBe(false);
    }
  });
});

describe("moduleSpecifierOf", () => {
  it("reads the module from an ES import, including one whose from is on the last line", () => {
    expect(moduleSpecifierOf('import { a } from "./x";')).toBe("./x");
    expect(moduleSpecifierOf('import {\n  a,\n} from "@acme/lib";')).toBe("@acme/lib");
  });

  it("reads the module from a require call", () => {
    expect(moduleSpecifierOf('const { a } = require("./x");')).toBe("./x");
  });

  it("returns null for a statement without a module", () => {
    expect(moduleSpecifierOf("use crate::a;")).toBeNull();
  });
});

describe("importSourceOf", () => {
  const packages = (name: string) => (name === "@acme/lib" ? "packages/lib" : null);

  it("maps a relative specifier to its checkout path without extension", () => {
    expect(importSourceOf("src/app.ts", 'import { a } from "./store";', packages)).toBe(
      "src/store",
    );
    expect(importSourceOf("src/app.ts", 'import { a } from "../lib/index.js";', packages)).toBe(
      "lib/index",
    );
  });

  it("maps a package specifier to the directory the resolver links it to", () => {
    expect(importSourceOf("src/app.ts", 'import { a } from "@acme/lib/sub";', packages)).toBe(
      "packages/lib",
    );
  });

  it("returns null for a package the resolver does not know, or an alias", () => {
    expect(importSourceOf("src/app.ts", 'import { a } from "left-pad";', packages)).toBeNull();
    expect(importSourceOf("src/app.ts", 'import { a } from "@/lib/foo";', packages)).toBeNull();
  });

  it("returns null when the statement names no module", () => {
    expect(importSourceOf("src/app.ts", "use crate::a;", packages)).toBeNull();
  });
});

describe("rankByImportSource", () => {
  it("moves a file inside the imported package ahead of other candidates", () => {
    const ranked = rankByImportSource(
      [{ path: "src/store.ts" }, { path: "packages/lib/src/index.ts" }],
      "packages/lib",
    );
    expect(ranked.map((item) => item.path)).toEqual(["packages/lib/src/index.ts", "src/store.ts"]);
  });

  it("moves the file a relative import names ahead of a same-named file elsewhere", () => {
    const ranked = rankByImportSource(
      [{ path: "lib/other/store.ts" }, { path: "src/store.ts" }],
      "src/store",
    );
    expect(ranked.map((item) => item.path)).toEqual(["src/store.ts", "lib/other/store.ts"]);
  });

  it("keeps the given order when the import has no source", () => {
    const items = [{ path: "b.ts" }, { path: "a.ts" }];
    expect(rankByImportSource(items, null)).toEqual([{ path: "b.ts" }, { path: "a.ts" }]);
  });
});
