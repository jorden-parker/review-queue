import path from "node:path";
import type { FileDiff, FileRole, Hunk, Step, StepFile, SymbolDefinition } from "@/lib/types";
import { classifyFile } from "./classify";

export type DefinitionLookup = { definitionsIn(file: string): SymbolDefinition[] };

export type ReadingPath = { steps: Step[]; startStepId: string | null };

type Chunk = { file: FileDiff; role: FileRole; hunkIndexes: number[]; part: number; parts: number };

const STEP_LINE_BUDGET = 150;
const LINES_PER_MINUTE = 15;
const ROLE_ORDER: FileRole[] = ["types", "core", "caller", "test", "config", "docs", "generated"];
const ROLE_REASONS: Record<FileRole, string> = {
  types: "Shapes and contracts first: the rest of the change builds on these.",
  core: "The main logic of the change.",
  caller: "Where the new logic gets wired in and used.",
  test: "Check the tests prove what the code claims.",
  config: "Config and build changes: quick, but easy to get wrong.",
  docs: "Docs: does the story match the code?",
  generated: "Generated files and lockfiles: skim or skip.",
};
const IDENTIFIER = /[A-Za-z_$][\w$]*/g;

export function estimateMinutes(changedLines: number): number {
  return Math.max(1, Math.round(changedLines / LINES_PER_MINUTE));
}

function changedLineCount(hunk: Hunk): number {
  return hunk.lines.filter((line) => line.kind !== "context").length;
}

function identifiersIn(file: FileDiff): Set<string> {
  const names = new Set<string>();
  for (const hunk of file.hunks) {
    for (const line of hunk.lines) {
      if (line.kind === "del") continue;
      for (const match of line.text.matchAll(IDENTIFIER)) names.add(match[0]);
    }
  }
  return names;
}

function dependencyMap(files: FileDiff[], lookup: DefinitionLookup): Map<string, Set<string>> {
  const definedBy = new Map<string, string>();
  for (const file of files) {
    for (const definition of lookup.definitionsIn(file.path))
      definedBy.set(definition.name, file.path);
  }
  const dependencies = new Map<string, Set<string>>();
  for (const file of files) {
    const used = new Set<string>();
    for (const name of identifiersIn(file)) {
      const owner = definedBy.get(name);
      if (owner && owner !== file.path) used.add(owner);
    }
    dependencies.set(file.path, used);
  }
  return dependencies;
}

function dependencyOrder(files: FileDiff[], dependencies: Map<string, Set<string>>): FileDiff[] {
  const ordered: FileDiff[] = [];
  const placed = new Set<string>();
  const remaining = [...files].sort((a, b) => a.path.localeCompare(b.path));
  while (remaining.length > 0) {
    const ready =
      remaining.find((file) =>
        [...(dependencies.get(file.path) ?? [])].every(
          (dependency) =>
            placed.has(dependency) || !remaining.some((other) => other.path === dependency),
        ),
      ) ?? remaining[0];
    ordered.push(ready);
    placed.add(ready.path);
    remaining.splice(remaining.indexOf(ready), 1);
  }
  return ordered;
}

function hunkGroups(file: FileDiff): number[][] {
  const groups: number[][] = [];
  let current: number[] = [];
  let size = 0;
  file.hunks.forEach((hunk, index) => {
    const count = changedLineCount(hunk);
    if (current.length > 0 && size + count > STEP_LINE_BUDGET) {
      groups.push(current);
      current = [];
      size = 0;
    }
    current.push(index);
    size += count;
  });
  if (current.length > 0 || groups.length === 0) groups.push(current);
  return groups;
}

function chunksFor(file: FileDiff, role: FileRole): Chunk[] {
  const groups = hunkGroups(file);
  return groups.map((hunkIndexes, index) => ({
    file,
    role,
    hunkIndexes,
    part: index + 1,
    parts: groups.length,
  }));
}

function chunkLines(chunk: Chunk): number {
  return chunk.hunkIndexes.reduce(
    (sum, index) => sum + changedLineCount(chunk.file.hunks[index]),
    0,
  );
}

function canJoin(group: Chunk[], chunk: Chunk): boolean {
  const first = group[0];
  return (
    first.parts === 1 &&
    chunk.parts === 1 &&
    first.role === chunk.role &&
    path.dirname(first.file.path) === path.dirname(chunk.file.path) &&
    group.reduce((sum, item) => sum + chunkLines(item), 0) + chunkLines(chunk) <= STEP_LINE_BUDGET
  );
}

function groupChunks(chunks: Chunk[]): Chunk[][] {
  const groups: Chunk[][] = [];
  for (const chunk of chunks) {
    const last = groups.at(-1);
    if (last && canJoin(last, chunk)) last.push(chunk);
    else groups.push([chunk]);
  }
  return groups;
}

function stepTitle(group: Chunk[]): string {
  const [first] = group;
  if (group.length > 1) return `${path.dirname(first.file.path)}/ (${group.length} files)`;
  const name = path.basename(first.file.path);
  return first.parts > 1 ? `${name} (part ${first.part} of ${first.parts})` : name;
}

function usersOf(file: string, dependencies: Map<string, Set<string>>): string[] {
  return [...dependencies]
    .filter(([, used]) => used.has(file))
    .map(([user]) => path.basename(user));
}

function stepReason(group: Chunk[], dependencies: Map<string, Set<string>>): string {
  const users = [...new Set(group.flatMap((chunk) => usersOf(chunk.file.path, dependencies)))];
  const reason = ROLE_REASONS[group[0].role];
  return users.length > 0 ? `${reason} Read before ${users.join(", ")}, which use it.` : reason;
}

function toStep(group: Chunk[], dependencies: Map<string, Set<string>>): Step {
  const [first] = group;
  const files: StepFile[] = group.map((chunk) => ({
    path: chunk.file.path,
    hunkIndexes: chunk.hunkIndexes,
  }));
  return {
    id: `${first.role}:${first.file.path}:${first.hunkIndexes[0] ?? 0}`,
    title: stepTitle(group),
    role: first.role,
    reason: stepReason(group, dependencies),
    changedLines: group.reduce((sum, chunk) => sum + chunkLines(chunk), 0),
    files,
  };
}

export function buildReadingPath(diffs: FileDiff[], lookup: DefinitionLookup): ReadingPath {
  const dependencies = dependencyMap(diffs, lookup);
  const chunks = ROLE_ORDER.flatMap((role) => {
    const files = diffs.filter((diff) => classifyFile(diff.path) === role);
    return dependencyOrder(files, dependencies).flatMap((file) => chunksFor(file, role));
  });
  const steps = groupChunks(chunks).map((group) => toStep(group, dependencies));
  return { steps, startStepId: steps[0]?.id ?? null };
}
