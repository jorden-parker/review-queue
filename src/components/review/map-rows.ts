import type { ChangeMap, ChangeNode, ChangeThread } from "@/lib/types";

export type MapRow = {
  key: string;
  node: ChangeNode;
  depth: number;
  kind: "entry" | "uses" | "test";
  done: boolean;
  current: boolean;
};

export type MapSection = { id: string; title: string; rows: MapRow[] };

type Context = {
  nodeById: Map<string, ChangeNode>;
  outgoing: Map<string, string[]>;
  doneSteps: readonly string[];
  currentStepId: string | null;
};

const MAX_DEPTH = 4;
const ORPHAN_SECTION_ID = "orphans";

export function mapSections(
  map: ChangeMap,
  doneSteps: readonly string[],
  currentStepId: string | null,
): MapSection[] {
  const context: Context = {
    nodeById: new Map(map.nodes.map((node) => [node.id, node])),
    outgoing: outgoingEdges(map),
    doneSteps,
    currentStepId,
  };
  const threadSections = map.threads.map((thread) => threadSection(thread, context));
  return map.orphanIds.length > 0
    ? [...threadSections, orphanSection(map.orphanIds, context)]
    : threadSections;
}

function outgoingEdges(map: ChangeMap): Map<string, string[]> {
  const outgoing = new Map<string, string[]>();
  for (const edge of map.edges) {
    outgoing.set(edge.from, [...(outgoing.get(edge.from) ?? []), edge.to]);
  }
  return outgoing;
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
  return { id: thread.id, title, rows };
}

function orphanSection(orphanIds: string[], context: Context): MapSection {
  const rows = nodesFor(orphanIds, context).map((node) =>
    rowFor(ORPHAN_SECTION_ID, node, 0, "uses", context),
  );
  return { id: ORPHAN_SECTION_ID, title: "Not connected", rows };
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
): MapRow {
  return {
    key: `${sectionId}|${node.id}`,
    node,
    depth,
    kind,
    done: node.stepId !== null && context.doneSteps.includes(node.stepId),
    current: context.currentStepId !== null && node.stepId === context.currentStepId,
  };
}

function baseName(path: string): string {
  return path.split("/").pop() ?? path;
}
