import { describe, expect, it } from "vitest";
import { buildFileTree, filterPaths } from "./file-tree";

describe("buildFileTree", () => {
  it("lists directories before files, each sorted by name", () => {
    const tree = buildFileTree(["zeta.ts", "docs/a.md", "alpha.ts", "app/b.ts", "app/c.ts"]);
    expect(tree.map((node) => node.name)).toEqual(["app", "docs", "alpha.ts", "zeta.ts"]);
    expect(tree[0].children?.map((node) => node.name)).toEqual(["b.ts", "c.ts"]);
  });

  it("gives files their full path and no children", () => {
    const [directory] = buildFileTree(["src/store.ts"]);
    expect(directory.path).toBe("src");
    expect(directory.children?.[0]).toEqual({
      name: "store.ts",
      path: "src/store.ts",
      children: null,
    });
  });

  it("collapses directories that hold only one directory into a single row", () => {
    const [collapsed] = buildFileTree(["src/lib/util/x.ts", "src/lib/util/y.ts"]);
    expect(collapsed).toMatchObject({ name: "src/lib/util", path: "src/lib/util" });
    expect(collapsed.children?.map((node) => node.path)).toEqual([
      "src/lib/util/x.ts",
      "src/lib/util/y.ts",
    ]);
  });

  it("keeps a directory open when it also holds a file", () => {
    const tree = buildFileTree(["src/lib/util/x.ts", "src/readme.md"]);
    expect(tree[0].name).toBe("src");
    expect(tree[0].children?.map((node) => node.name)).toEqual(["lib/util", "readme.md"]);
  });
});

describe("filterPaths", () => {
  const paths = ["src/app/page.tsx", "src/lib/store.ts", "docs/store-notes.md"];

  it("returns every path for an empty query", () => {
    expect(filterPaths(paths, "")).toEqual(paths);
    expect(filterPaths(paths, "   ")).toEqual(paths);
  });

  it("keeps paths that contain every word, ignoring case", () => {
    expect(filterPaths(paths, "STORE ts")).toEqual(["src/lib/store.ts"]);
  });

  it("matches across directories", () => {
    expect(filterPaths(paths, "src page")).toEqual(["src/app/page.tsx"]);
  });
});
