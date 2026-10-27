import type { ChangeMap, ChangeNode, ChangeThread } from "@/lib/types";
import { hunkElementId } from "./hunk-index";

export type MapRow = {
  key: string;
  node: ChangeNode;
  depth: number;
  kind: "entry" | "uses" | "test";
  done: boolean;
  current: boolean;
  showPath: boolean;
  showRole: boolean;
  linkedIds: string[];
};

export type MapSection = {
  id: string;
  title: string;
  rows: MapRow[];
  readCount: number;
  total: number;
  connected: boolean;
};

export type NodePart = { part: string; weight: string };

export type MapFilters = { hideRead: boolean; hideIncidental: boolean };

type PlacedRow = Omit<MapRow, "showPath" | "showRole">;

type Context = {
  nodeById: Map<string, ChangeNode>;
  outgoing: Map<string, string[]>;
  incoming: Map<string, string[]>;
  doneSteps: readonly string[];
  currentNodeId: string | null;
};

const MAX_DEPTH = 4;
const ORPHAN_SECTION_ID = "orphans";

export function mapSections(
  map: ChangeMap,
  doneSteps: readonly string[],
  activeHunkId: string | null,
): MapSection[] {
  const context: Context = {
    nodeById: new Map(map.nodes.map((node) => [node.id, node])),
    outgoing: edgesBy(map, "from", "to"),
    incoming: edgesBy(map, "to", "from"),
    doneSteps,
    currentNodeId: currentNodeId(map.nodes, activeHunkId),
  };
  const threadSections = map.threads.map((thread) => threadSection(thread, context));
  return map.orphanIds.length > 0
    ? [...threadSections, orphanSection(map.orphanIds, context)]
    : threadSections;
}

export function visibleRows(
  rows: MapRow[],
  filters: MapFilters,
  parts: ReadonlyMap<string, NodePart> | undefined,
): MapRow[] {
  return rows.filter(
    (row) =>
      row.current ||
      !(
        (filters.hideRead && row.done) ||
        (filters.hideIncidental && parts?.get(row.node.id)?.weight === "incidental")
      ),
  );
}

export function initiallyCollapsed(sections: MapSection[]): Set<string> {
  return new Set(
    sections
      .filter((section) => section.readCount === section.total)
      .filter((section) => !section.rows.some((row) => row.current))
      .map((section) => section.id),
  );
}

function currentNodeId(nodes: ChangeNode[], activeHunkId: string | null): string | null {
  const holder = nodes.find((node) =>
    node.hunkIndexes.some((index) => hunkElementId(node.path, index) === activeHunkId),
  );
  return holder?.id ?? null;
}

function edgesBy(map: ChangeMap, key: "from" | "to", value: "from" | "to"): Map<string, string[]> {
  const edges = new Map<string, string[]>();
  for (const edge of map.edges) {
    edges.set(edge[key], [...(edges.get(edge[key]) ?? []), edge[value]]);
  }
  return edges;
}

function sectionOf(id: string, title: string, placed: PlacedRow[], connected: boolean): MapSection {
  const rows = placed.map((row, index) => ({
    ...row,
    showPath: index === 0 || placed[index - 1].node.path !== row.node.path,
    showRole: index === 0 || placed[0].node.role !== row.node.role,
  }));
  return {
    id,
    title,
    rows,
    readCount: rows.filter((row) => row.done).length,
    total: rows.length,
    connected,
  };
}

function threadSection(thread: ChangeThread, context: Context): MapSection {
  const distances = distancesFrom(thread.entryId, context.outgoing);
  const entry = nodesFor([thread.entryId], context);
  const uses = nodesFor(
    thread.nodeIds.filter((id) => id !== thread.entryId),
    context,
  );
  const tests = nodesFor(thread.testIds, context);
  const rows = [
    ...entry.map((node) => rowFor(thread.id, node, 0, "entry", context)),
    ...uses.map((node) =>
      rowFor(thread.id, node, Math.min(distances.get(node.id) ?? 1, MAX_DEPTH), "uses", context),
    ),
    ...tests.map((node) => rowFor(thread.id, node, 1, "test", context)),
  ];
  const title = entry[0] ? (entry[0].name ?? baseName(entry[0].path)) : thread.entryId;
  return sectionOf(thread.id, title, rows, true);
}

function orphanSection(orphanIds: string[], context: Context): MapSection {
  const rows = nodesFor(orphanIds, context).map((node) =>
    rowFor(ORPHAN_SECTION_ID, node, 0, "uses", context),
  );
  return sectionOf(ORPHAN_SECTION_ID, "Not connected", rows, false);
}

function distancesFrom(entryId: string, outgoing: Map<string, string[]>): Map<string, number> {
  const distances = new Map([[entryId, 0]]);
  const queue = [entryId];
  for (const id of queue) {
    const distance = distances.get(id) ?? 0;
    for (const next of outgoing.get(id) ?? []) {
      if (!distances.has(next)) {
        distances.set(next, distance + 1);
        queue.push(next);
      }
    }
  }
  return distances;
}

function nodesFor(ids: string[], context: Context): ChangeNode[] {
  return ids.flatMap((id) => {
    const node = context.nodeById.get(id);
    return node ? [node] : [];
  });
}

function rowFor(
  sectionId: string,
  node: ChangeNode,
  depth: number,
  kind: MapRow["kind"],
  context: Context,
): PlacedRow {
  return {
    key: `${sectionId}|${node.id}`,
    node,
    depth,
    kind,
    done: node.stepId !== null && context.doneSteps.includes(node.stepId),
    current: node.id === context.currentNodeId,
    linkedIds: [...(context.outgoing.get(node.id) ?? []), ...(context.incoming.get(node.id) ?? [])],
  };
}

function baseName(path: string): string {
  return path.split("/").pop() ?? path;
}
