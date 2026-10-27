import { describe, expect, it } from "vitest";
import type { DefinitionLookup } from "@/lib/plan/reading-path";
import type { Step, SymbolDefinition } from "@/lib/types";
import { addedHunk, fileDiff, removedHunk } from "@/test/diff-builders";
import { buildChangeMap } from "./change-map";

type Span = [name: string, line: number, endLine: number];

function lookup(definitions: Record<string, Span[]>): DefinitionLookup {
  return {
    definitionsIn: (file: string): SymbolDefinition[] =>
      (definitions[file] ?? []).map(([name, line, endLine]) => ({
        name,
        kind: "function",
        path: file,
        line,
        endLine,
      })),
  };
}

const NO_STEPS: Step[] = [];

describe("buildChangeMap", () => {
  it("makes a symbol node for a changed line inside a definition", () => {
    const diffs = [fileDiff("a.ts", [addedHunk(["const x = 1"], 5)])];
    const map = buildChangeMap(diffs, lookup({ "a.ts": [["handle", 3, 8]] }), NO_STEPS);

    expect(map.nodes).toHaveLength(1);
    expect(map.nodes[0]).toMatchObject({
      id: "a.ts#handle",
      path: "a.ts",
      name: "handle",
      kind: "function",
      line: 3,
      hunkIndexes: [0],
    });
  });

  it("merges two hunks inside the same definition into one node", () => {
    const diffs = [fileDiff("a.ts", [addedHunk(["one"], 4), addedHunk(["two"], 6)])];
    const map = buildChangeMap(diffs, lookup({ "a.ts": [["handle", 3, 8]] }), NO_STEPS);

    expect(map.nodes).toHaveLength(1);
    expect(map.nodes[0].hunkIndexes).toEqual([0, 1]);
  });

  it("assigns a changed line to the innermost enclosing definition", () => {
    const diffs = [fileDiff("a.ts", [addedHunk(["inside"], 6)])];
    const definitions = lookup({
      "a.ts": [
        ["outer", 1, 20],
        ["inner", 5, 8],
      ],
    });
    const map = buildChangeMap(diffs, definitions, NO_STEPS);

    expect(map.nodes.map((node) => node.name)).toEqual(["inner"]);
  });

  it("makes a file node for a changed line outside every definition", () => {
    const diffs = [fileDiff("a.ts", [addedHunk(["import x"], 2)])];
    const map = buildChangeMap(diffs, lookup({ "a.ts": [["handle", 10, 20]] }), NO_STEPS);

    expect(map.nodes).toEqual([
      expect.objectContaining({
        id: "a.ts#file",
        name: null,
        kind: "file",
        line: 2,
        hunkIndexes: [0],
      }),
    ]);
  });

  it("makes one file node at line 1 for a deleted file", () => {
    const diffs = [
      fileDiff("gone.ts", [removedHunk(["export const a = 1", "export const b = 2"])], {
        status: "deleted",
      }),
    ];
    const map = buildChangeMap(diffs, lookup({}), NO_STEPS);

    expect(map.nodes).toEqual([
      expect.objectContaining({ id: "gone.ts#file", kind: "file", line: 1 }),
    ]);
  });

  it("links a node to a changed symbol its added lines mention, and never to itself", () => {
    const diffs = [
      fileDiff("a.ts", [addedHunk(["const v = save(handle)", "console.log(v)"], 2)]),
      fileDiff("b.ts", [addedHunk(["function save() {}"], 1)]),
    ];
    const map = buildChangeMap(
      diffs,
      lookup({ "a.ts": [["handle", 1, 5]], "b.ts": [["save", 1, 1]] }),
      NO_STEPS,
    );

    expect(map.edges).toEqual([{ from: "a.ts#handle", to: "b.ts#save" }]);
  });

  it("ignores deleted lines when collecting edges", () => {
    const diffs = [
      fileDiff("a.ts", [
        {
          header: "",
          oldStart: 2,
          newStart: 2,
          lines: [{ kind: "del", text: "writeRow()", oldLine: 2, newLine: null }],
        },
      ]),
      fileDiff("b.ts", [addedHunk(["function writeRow() {}"], 1)]),
    ];
    const map = buildChangeMap(
      diffs,
      lookup({ "a.ts": [["handle", 1, 5]], "b.ts": [["writeRow", 1, 1]] }),
      NO_STEPS,
    );

    expect(map.edges).toEqual([]);
  });

  it("builds a thread from an entry down through what it uses, depth first", () => {
    const diffs = [
      fileDiff("routes.ts", [addedHunk(["return saveSettings(req)"], 2)]),
      fileDiff("settings.ts", [addedHunk(["return writeRow(data)"], 2)]),
      fileDiff("db.ts", [addedHunk(["insert()"], 2)]),
    ];
    const map = buildChangeMap(
      diffs,
      lookup({
        "routes.ts": [["handler", 1, 5]],
        "settings.ts": [["saveSettings", 1, 5]],
        "db.ts": [["writeRow", 1, 5]],
      }),
      NO_STEPS,
    );

    expect(map.threads).toEqual([
      {
        id: "routes.ts#handler",
        entryId: "routes.ts#handler",
        nodeIds: ["routes.ts#handler", "settings.ts#saveSettings", "db.ts#writeRow"],
        testIds: [],
      },
    ]);
  });

  it("attaches a test node to the thread it points into instead of making it an entry", () => {
    const diffs = [
      fileDiff("routes.ts", [addedHunk(["return saveSettings(req)"], 2)]),
      fileDiff("settings.ts", [addedHunk(["function saveSettings() {}"], 1)]),
      fileDiff("settings.test.ts", [addedHunk(["expect(saveSettings()).toBe(1)"], 2)]),
    ];
    const map = buildChangeMap(
      diffs,
      lookup({
        "routes.ts": [["handler", 1, 5]],
        "settings.ts": [["saveSettings", 1, 5]],
        "settings.test.ts": [["saves", 1, 5]],
      }),
      NO_STEPS,
    );

    expect(map.threads).toHaveLength(1);
    expect(map.threads[0]).toMatchObject({
      entryId: "routes.ts#handler",
      testIds: ["settings.test.ts#saves"],
    });
  });

  it("still makes a thread for a cycle with no entry, starting at the first node in order", () => {
    const diffs = [
      fileDiff("x.ts", [addedHunk(["call(b)"], 2)]),
      fileDiff("y.ts", [addedHunk(["call(a)"], 2)]),
    ];
    const map = buildChangeMap(
      diffs,
      lookup({ "x.ts": [["a", 1, 5]], "y.ts": [["b", 1, 5]] }),
      NO_STEPS,
    );

    expect(map.threads).toHaveLength(1);
    expect(map.threads[0].entryId).toBe("x.ts#a");
    expect(map.threads[0].nodeIds).toEqual(["x.ts#a", "y.ts#b"]);
  });

  it("lists a node with no edges as an orphan and in no thread", () => {
    const diffs = [fileDiff("lonely.ts", [addedHunk(["const z = 1"], 2)])];
    const map = buildChangeMap(diffs, lookup({ "lonely.ts": [["lonely", 1, 5]] }), NO_STEPS);

    expect(map.orphanIds).toEqual(["lonely.ts#lonely"]);
    expect(map.threads).toEqual([]);
  });

  it("gives each node the id of the step that holds its file and hunk", () => {
    const diffs = [
      fileDiff("a.ts", [addedHunk(["one"], 2)]),
      fileDiff("b.ts", [addedHunk(["two"], 2)]),
    ];
    const steps: Step[] = [
      {
        id: "step-1",
        title: "Core",
        role: "core",
        reason: "",
        changedLines: 1,
        files: [{ path: "a.ts", hunkIndexes: [0] }],
      },
    ];
    const map = buildChangeMap(
      diffs,
      lookup({ "a.ts": [["one", 1, 5]], "b.ts": [["two", 1, 5]] }),
      steps,
    );

    expect(map.nodes.map((node) => [node.path, node.stepId])).toEqual([
      ["a.ts", "step-1"],
      ["b.ts", null],
    ]);
  });

  it("sorts threads by node count, largest first, keeping node order on ties", () => {
    const diffs = [
      fileDiff("p.ts", [addedHunk(["call(q)"], 2)]),
      fileDiff("q.ts", [addedHunk(["leaf()"], 2)]),
      fileDiff("r.ts", [addedHunk(["call(s)"], 2)]),
      fileDiff("s.ts", [addedHunk(["call(t)"], 2)]),
      fileDiff("t.ts", [addedHunk(["leaf()"], 2)]),
    ];
    const map = buildChangeMap(
      diffs,
      lookup({
        "p.ts": [["p", 1, 5]],
        "q.ts": [["q", 1, 5]],
        "r.ts": [["r", 1, 5]],
        "s.ts": [["s", 1, 5]],
        "t.ts": [["t", 1, 5]],
      }),
      NO_STEPS,
    );

    expect(map.threads.map((thread) => thread.entryId)).toEqual(["r.ts#r", "p.ts#p"]);
    expect(map.threads.map((thread) => thread.nodeIds.length)).toEqual([3, 2]);
  });
});
