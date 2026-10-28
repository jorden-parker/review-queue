import { classifyFile } from "@/lib/plan/classify";
import { languageFor } from "@/lib/symbols/languages";
import type { Reference, SymbolIndex } from "@/lib/symbols/symbol-index";
import type { SymbolDefinition } from "@/lib/types";
import { declarationsIn, innermostAt, isSameDefinition, spans } from "./declarations";

export type ReferencesOf = (name: string) => Promise<Reference[]>;

export type PathStep = SymbolDefinition & { call: Reference };

export type CallPath = { steps: PathStep[]; end: "entry" | "more" };

type CallPathIndex = Pick<SymbolIndex, "definitionsIn">;

const MAX_DEPTH = 3;
const MAX_CALLERS_PER_STEP = 3;
const MAX_PATHS = 6;
const TOP_LEVEL = "(top level)";

export const IMPORT_LINE = /^\s*(import\b|export\s*(\*|\{))/;

export function isProductionCode(path: string): boolean {
  const role = classifyFile(path);
  return languageFor(path) !== null && role !== "test" && role !== "generated";
}

function topLevelStep(use: Reference): PathStep {
  return {
    name: TOP_LEVEL,
    kind: "module",
    path: use.path,
    line: use.line,
    endLine: use.line,
    call: use,
  };
}

function stepFor(index: CallPathIndex, use: Reference): PathStep {
  const caller = innermostAt(declarationsIn(index, use.path), use.line);
  return caller ? { ...caller, call: use } : topLevelStep(use);
}

async function callersOf(
  index: CallPathIndex,
  callee: SymbolDefinition,
  referencesOf: ReferencesOf,
): Promise<PathStep[]> {
  if (callee.name === TOP_LEVEL) return [];
  const uses = (await referencesOf(callee.name)).filter(
    (use) =>
      isProductionCode(use.path) &&
      !IMPORT_LINE.test(use.text) &&
      !(use.path === callee.path && spans(callee, use.line)),
  );
  const steps: PathStep[] = [];
  for (const step of uses.map((use) => stepFor(index, use))) {
    if (!steps.some((seen) => isSameDefinition(seen, step))) steps.push(step);
  }
  return steps.slice(0, MAX_CALLERS_PER_STEP);
}

async function walk(
  index: CallPathIndex,
  referencesOf: ReferencesOf,
  callee: SymbolDefinition,
  chain: PathStep[],
): Promise<CallPath[]> {
  if (chain.length === MAX_DEPTH) return [{ steps: chain, end: "more" }];
  const callers = await callersOf(index, callee, referencesOf);
  if (callers.length === 0) return [{ steps: chain, end: "entry" }];
  const onPath = (step: PathStep) =>
    chain.some((seen) => isSameDefinition(seen, step)) || isSameDefinition(step, callee);
  const fresh = callers.filter((step) => !onPath(step));
  if (fresh.length === 0) return [{ steps: chain, end: "more" }];
  const branches = await Promise.all(
    fresh.map((step) => walk(index, referencesOf, step, [step, ...chain])),
  );
  return branches.flat();
}

export async function callPathsTo(
  index: CallPathIndex,
  target: SymbolDefinition,
  referencesOf: ReferencesOf,
): Promise<CallPath[]> {
  return (await walk(index, referencesOf, target, [])).slice(0, MAX_PATHS);
}
