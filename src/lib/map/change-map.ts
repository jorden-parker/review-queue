import { classifyFile } from "@/lib/plan/classify";
import type { DefinitionLookup } from "@/lib/plan/reading-path";
import type {
  ChangeEdge,
  ChangeMap,
  ChangeNode,
  ChangeThread,
  FileDiff,
  FileRole,
  Hunk,
  Step,
  SymbolDefinition,
} from "@/lib/types";

const IDENTIFIER = /[A-Za-z_$][\w$]*/g;
const MAX_DEPTH = 8;

export function buildChangeMap(
  diffs: FileDiff[],
  lookup: DefinitionLookup,
  steps: Step[],
): ChangeMap {
  const diffsByPath = new Map(diffs.map((file) => [file.path, file]));
  const nodes = diffs
    .flatMap((file) => nodesForFile(file, lookup))
    .map((node) => ({ ...node, stepId: stepIdFor(node, steps) }));
  const edges = edgesBetween(nodes, diffsByPath);
  const connected = new Set(edges.flatMap((edge) => [edge.from, edge.to]));
  return {
    nodes,
    edges,
    threads: threadsFrom(nodes, edges, connected),
    orphanIds: nodes.filter((node) => !connected.has(node.id)).map((node) => node.id),
  };
}

function nodesForFile(file: FileDiff, lookup: DefinitionLookup): ChangeNode[] {
  const role = classifyFile(file.path);
  if (file.status === "deleted") {
    return [fileNode(file.path, role, 1, allHunkIndexes(file))];
  }
  const definitions = lookup.definitionsIn(file.path);
  const merged = new Map<string, ChangeNode>();
  file.hunks.forEach((hunk, hunkIndex) => {
    for (const line of changedLinesOf(hunk)) {
      mergeNode(merged, nodeForLine(file.path, role, definitions, line, hunkIndex));
    }
  });
  return [...merged.values()].sort((a, b) => a.line - b.line);
}

function allHunkIndexes(file: FileDiff): number[] {
  return file.hunks.map((_, index) => index);
}

function changedLinesOf(hunk: Hunk): number[] {
  const changed: number[] = [];
  let anchor = hunk.newStart;
  for (const line of hunk.lines) {
    if (line.newLine !== null) anchor = line.newLine;
    if (line.kind === "add" && line.newLine !== null) changed.push(line.newLine);
    if (line.kind === "del") changed.push(anchor);
  }
  return changed;
}

function nodeForLine(
  path: string,
  role: FileRole,
  definitions: SymbolDefinition[],
  line: number,
  hunkIndex: number,
): ChangeNode {
  const definition = innermostDefinition(definitions, line);
  return definition
    ? symbolNode(path, role, definition, hunkIndex)
    : fileNode(path, role, line, [hunkIndex]);
}

function innermostDefinition(
  definitions: SymbolDefinition[],
  line: number,
): SymbolDefinition | undefined {
  return definitions
    .filter((definition) => definition.line <= line && line <= definition.endLine)
    .sort((a, b) => a.endLine - a.line - (b.endLine - b.line))[0];
}

function symbolNode(
  path: string,
  role: FileRole,
  definition: SymbolDefinition,
  hunkIndex: number,
): ChangeNode {
  return {
    id: `${path}#${definition.name}`,
    path,
    name: definition.name,
    kind: definition.kind,
    role,
    line: definition.line,
    hunkIndexes: [hunkIndex],
    stepId: null,
  };
}

function fileNode(path: string, role: FileRole, line: number, hunkIndexes: number[]): ChangeNode {
  return {
    id: `${path}#file`,
    path,
    name: null,
    kind: "file",
    role,
    line,
    hunkIndexes,
    stepId: null,
  };
}

function mergeNode(merged: Map<string, ChangeNode>, node: ChangeNode): void {
  const existing = merged.get(node.id);
  if (!existing) {
    merged.set(node.id, node);
    return;
  }
  const hunkIndexes = [...new Set([...existing.hunkIndexes, ...node.hunkIndexes])];
  merged.set(node.id, { ...existing, hunkIndexes });
}

function stepIdFor(node: ChangeNode, steps: Step[]): string | null {
  const step = steps.find((candidate) =>
    candidate.files.some(
      (file) =>
        file.path === node.path &&
        file.hunkIndexes.some((index) => node.hunkIndexes.includes(index)),
    ),
  );
  return step?.id ?? null;
}

function edgesBetween(nodes: ChangeNode[], diffsByPath: Map<string, FileDiff>): ChangeEdge[] {
  const edges: ChangeEdge[] = [];
  for (const from of nodes) {
    const names = mentionedNames(diffsByPath.get(from.path), from.hunkIndexes);
    for (const to of nodes) {
      if (to.id !== from.id && to.name !== null && names.has(to.name)) {
        edges.push({ from: from.id, to: to.id });
      }
    }
  }
  return edges;
}

function mentionedNames(file: FileDiff | undefined, hunkIndexes: number[]): Set<string> {
  const names = new Set<string>();
  for (const index of hunkIndexes) {
    for (const line of file?.hunks[index]?.lines ?? []) {
      if (line.kind === "del") continue;
      for (const match of line.text.matchAll(IDENTIFIER)) names.add(match[0]);
    }
  }
  return names;
}

function threadsFrom(
  nodes: ChangeNode[],
  edges: ChangeEdge[],
  connected: Set<string>,
): ChangeThread[] {
  const roleOf = new Map(nodes.map((node) => [node.id, node.role]));
  const isCode = (id: string) => roleOf.get(id) !== "test";
  const codeEdges = edges.filter((edge) => isCode(edge.from) && isCode(edge.to));
  const callees = adjacency(codeEdges);
  const calledFromCode = new Set(codeEdges.map((edge) => edge.to));
  const entryIds = nodes
    .map((node) => node.id)
    .filter((id) => isCode(id) && callees.has(id) && !calledFromCode.has(id));
  const linkedIds = nodes.map((node) => node.id).filter((id) => isCode(id) && connected.has(id));

  const covered = new Set<string>();
  const threads: ChangeThread[] = [];
  for (const startId of [...entryIds, ...linkedIds]) {
    if (covered.has(startId)) continue;
    const nodeIds = walkThread(startId, callees);
    nodeIds.forEach((id) => covered.add(id));
    threads.push({ id: startId, entryId: startId, nodeIds, testIds: [] });
  }

  return attachTests(threads, nodes, edges).sort((a, b) => b.nodeIds.length - a.nodeIds.length);
}

function adjacency(edges: ChangeEdge[]): Map<string, string[]> {
  const map = new Map<string, string[]>();
  for (const edge of edges) {
    map.set(edge.from, [...(map.get(edge.from) ?? []), edge.to]);
  }
  return map;
}

function walkThread(entryId: string, callees: Map<string, string[]>): string[] {
  const visited: string[] = [];
  const visit = (id: string, depth: number) => {
    if (visited.includes(id) || depth > MAX_DEPTH) return;
    visited.push(id);
    for (const next of callees.get(id) ?? []) visit(next, depth + 1);
  };
  visit(entryId, 0);
  return visited;
}

function attachTests(
  threads: ChangeThread[],
  nodes: ChangeNode[],
  edges: ChangeEdge[],
): ChangeThread[] {
  const testIds = nodes.filter((node) => node.role === "test").map((node) => node.id);
  return threads.map((thread) => ({
    ...thread,
    testIds: testIds.filter((testId) =>
      edges.some((edge) => edge.from === testId && thread.nodeIds.includes(edge.to)),
    ),
  }));
}
