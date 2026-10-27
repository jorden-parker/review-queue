import { describe, expect, it } from "vitest";
import type { ChangeEdge, ChangeMap, ChangeNode } from "@/lib/types";
import { initiallyCollapsed, mapSections, visibleRows } from "./map-rows";

function node(id: string, overrides: Partial<ChangeNode> = {}): ChangeNode {
  return {
    id,
    path: `src/${id}.ts`,
    name: id,
    kind: "function",
    role: "core",
    line: 1,
    hunkIndexes: [0],
    stepId: null,
    ...overrides,
  };
}

function mapOf(parts: Partial<ChangeMap> & { nodes: ChangeNode[] }): ChangeMap {
  return { edges: [], threads: [], orphanIds: [], ...parts };
}

function chain(ids: string[]): ChangeEdge[] {
  return ids.slice(1).map((to, index) => ({ from: ids[index], to }));
}

describe("mapSections", () => {
  it("makes one section per thread with the entry, what it uses, then its tests", () => {
    const map = mapOf({
      nodes: [node("a"), node("b"), node("c"), node("t", { role: "test" })],
      edges: [...chain(["a", "b", "c"]), { from: "t", to: "c" }],
      threads: [{ id: "a", entryId: "a", nodeIds: ["a", "b", "c"], testIds: ["t"] }],
    });

    const [section] = mapSections(map, [], null);

    expect(section.id).toBe("a");
    expect(section.connected).toBe(true);
    expect(section.title).toBe("a");
    expect(section.rows.map((row) => [row.node.id, row.depth, row.kind])).toEqual([
      ["a", 0, "entry"],
      ["b", 1, "uses"],
      ["c", 2, "uses"],
      ["t", 1, "test"],
    ]);
  });

  it("caps the depth of a deep chain at 4", () => {
    const ids = ["n0", "n1", "n2", "n3", "n4", "n5"];
    const map = mapOf({
      nodes: ids.map((id) => node(id)),
      edges: chain(ids),
      threads: [{ id: "n0", entryId: "n0", nodeIds: ids, testIds: [] }],
    });

    const [section] = mapSections(map, [], null);

    expect(section.rows.map((row) => row.depth)).toEqual([0, 1, 2, 3, 4, 4]);
  });

  it("titles a thread with the file's basename when the entry has no name", () => {
    const map = mapOf({
      nodes: [node("cfg#file", { name: null, path: "config/app.ts", kind: "file" })],
      threads: [{ id: "cfg#file", entryId: "cfg#file", nodeIds: ["cfg#file"], testIds: [] }],
    });

    expect(mapSections(map, [], null)[0].title).toBe("app.ts");
  });

  it("adds a Not connected section for orphans, with rows at depth 0", () => {
    const map = mapOf({
      nodes: [node("z")],
      orphanIds: ["z"],
    });

    const sections = mapSections(map, [], null);

    expect(sections).toHaveLength(1);
    expect(sections[0]).toMatchObject({ id: "orphans", title: "Not connected", connected: false });
    expect(sections[0].rows.map((row) => [row.node.id, row.depth, row.kind])).toEqual([
      ["z", 0, "uses"],
    ]);
  });

  it("adds no orphan section when every node is connected", () => {
    const map = mapOf({
      nodes: [node("a"), node("b")],
      edges: chain(["a", "b"]),
      threads: [{ id: "a", entryId: "a", nodeIds: ["a", "b"], testIds: [] }],
    });

    expect(mapSections(map, [], null).map((section) => section.id)).toEqual(["a"]);
  });

  it("marks rows done when their step is done and current when it is the current step", () => {
    const map = mapOf({
      nodes: [
        node("a", { stepId: "s1" }),
        node("b", { stepId: "s2" }),
        node("c", { stepId: "s3" }),
      ],
      edges: chain(["a", "b", "c"]),
      threads: [{ id: "a", entryId: "a", nodeIds: ["a", "b", "c"], testIds: [] }],
    });

    const rows = mapSections(map, ["s1"], "s2")[0].rows;

    expect(rows.map((row) => [row.node.id, row.done, row.current])).toEqual([
      ["a", true, false],
      ["b", false, true],
      ["c", false, false],
    ]);
  });

  it("does not mark a node with no step as current when there is no current step", () => {
    const map = mapOf({
      nodes: [node("a", { stepId: null })],
      orphanIds: ["a"],
    });

    expect(mapSections(map, [], null)[0].rows[0].current).toBe(false);
  });

  it("keys each row by section and node so a node can appear in two threads", () => {
    const map = mapOf({
      nodes: [node("a"), node("b"), node("c")],
      edges: [
        { from: "a", to: "c" },
        { from: "b", to: "c" },
      ],
      threads: [
        { id: "a", entryId: "a", nodeIds: ["a", "c"], testIds: [] },
        { id: "b", entryId: "b", nodeIds: ["b", "c"], testIds: [] },
      ],
    });

    const keys = mapSections(map, [], null).flatMap((section) =>
      section.rows.map((row) => row.key),
    );

    expect(keys).toEqual(["a|a", "a|c", "b|b", "b|c"]);
  });

  it("counts how many rows of each section are read", () => {
    const map = mapOf({
      nodes: [node("a", { stepId: "s1" }), node("b", { stepId: "s2" }), node("c")],
      edges: chain(["a", "b", "c"]),
      threads: [{ id: "a", entryId: "a", nodeIds: ["a", "b", "c"], testIds: [] }],
    });

    expect(mapSections(map, ["s1"], null)[0]).toMatchObject({ readCount: 1, total: 3 });
  });

  it("shows a row's path only when it differs from the row above", () => {
    const map = mapOf({
      nodes: [
        node("a", { path: "src/one.ts" }),
        node("b", { path: "src/one.ts" }),
        node("c", { path: "src/two.ts" }),
      ],
      edges: chain(["a", "b", "c"]),
      threads: [{ id: "a", entryId: "a", nodeIds: ["a", "b", "c"], testIds: [] }],
    });

    const rows = mapSections(map, [], null)[0].rows;

    expect(rows.map((row) => row.showPath)).toEqual([true, false, true]);
  });

  it("shows a row's role only on the entry and where it differs from the entry's", () => {
    const map = mapOf({
      nodes: [node("a"), node("b"), node("c", { role: "config" })],
      edges: chain(["a", "b", "c"]),
      threads: [{ id: "a", entryId: "a", nodeIds: ["a", "b", "c"], testIds: [] }],
    });

    const rows = mapSections(map, [], null)[0].rows;

    expect(rows.map((row) => row.showRole)).toEqual([true, false, true]);
  });

  it("links each row to the nodes it calls and the nodes that call it", () => {
    const map = mapOf({
      nodes: [node("a"), node("b"), node("c")],
      edges: chain(["a", "b", "c"]),
      threads: [{ id: "a", entryId: "a", nodeIds: ["a", "b", "c"], testIds: [] }],
    });

    const rows = mapSections(map, [], null)[0].rows;

    expect(rows.map((row) => [row.node.id, row.linkedIds])).toEqual([
      ["a", ["b"]],
      ["b", ["c", "a"]],
      ["c", ["b"]],
    ]);
  });
});

describe("visibleRows", () => {
  const map = mapOf({
    nodes: [node("a", { stepId: "s1" }), node("b", { stepId: "s2" }), node("c", { stepId: "s3" })],
    edges: chain(["a", "b", "c"]),
    threads: [{ id: "a", entryId: "a", nodeIds: ["a", "b", "c"], testIds: [] }],
  });
  const weights = new Map([
    ["b", { part: "", weight: "incidental" }],
    ["c", { part: "", weight: "incidental" }],
  ]);

  it("keeps every row when no filter is on", () => {
    const rows = mapSections(map, ["s1"], null)[0].rows;

    expect(visibleRows(rows, { hideRead: false, hideIncidental: false }, weights)).toEqual(rows);
  });

  it("drops read rows and incidental rows but never the current one", () => {
    const rows = mapSections(map, ["s1"], "s3")[0].rows;

    const ids = visibleRows(rows, { hideRead: true, hideIncidental: true }, weights).map(
      (row) => row.node.id,
    );

    expect(ids).toEqual(["c"]);
  });
});

describe("initiallyCollapsed", () => {
  it("collapses fully read sections unless they hold the current row", () => {
    const map = mapOf({
      nodes: [
        node("a", { stepId: "s1" }),
        node("b", { stepId: "s2" }),
        node("c", { stepId: "s3" }),
      ],
      threads: [
        { id: "a", entryId: "a", nodeIds: ["a"], testIds: [] },
        { id: "b", entryId: "b", nodeIds: ["b"], testIds: [] },
        { id: "c", entryId: "c", nodeIds: ["c"], testIds: [] },
      ],
    });

    const sections = mapSections(map, ["s1", "s2"], "s2");

    expect([...initiallyCollapsed(sections)]).toEqual(["a"]);
  });
});
