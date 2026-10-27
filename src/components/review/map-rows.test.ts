import { describe, expect, it } from "vitest";
import type { ChangeEdge, ChangeMap, ChangeNode } from "@/lib/types";
import { mapSections } from "./map-rows";

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
    expect(sections[0]).toMatchObject({ id: "orphans", title: "Not connected" });
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
});
