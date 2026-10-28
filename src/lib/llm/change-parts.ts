import { z } from "zod";
import type { ChangeMap, ChangeNode, FileDiff } from "@/lib/types";
import {
  askForJson,
  CODE_NAME_RULE,
  diffText,
  fenced,
  fencedTitle,
  jsonObjectIn,
  type LlmConfig,
  type ModelRequest,
  UNTRUSTED_DATA_RULE,
} from "./client";

export type ChangePartsInput = {
  title: string;
  map: ChangeMap;
  diffs: FileDiff[];
};

const NODE_LIMIT = 40;
const DIFF_CHAR_BUDGET = 16_000;
const MAX_TOKENS = 1200;
const PART_LIMIT = 120;

const ChangePartsSchema = z.object({
  parts: z
    .array(
      z.object({
        id: z.string(),
        part: z.string(),
        weight: z.enum(["essential", "supporting", "incidental"]),
      }),
    )
    .default([]),
});

export const ChangePartsRecordSchema = ChangePartsSchema.extend({ model: z.string() });

export type ChangeParts = z.infer<typeof ChangePartsRecordSchema>;

const SYSTEM_PROMPT = `You help a reviewer with ADHD see how the changes in a pull request fit together.
Reply with ONLY a JSON object, no prose and no code fences, matching:
{"parts": [{"id": "<ref from the list, such as c1>", "part": "at most 12 words on what this change does for the PR", "weight": "essential" | "supporting" | "incidental"}]}
Only use refs from the list. Return exactly one entry for every change in the list, in the same order.
Describe each change's role in the PR, not its mechanics.
${UNTRUSTED_DATA_RULE}
${CODE_NAME_RULE}`;

function listedNodes(map: ChangeMap): ChangeNode[] {
  const byId = new Map(map.nodes.map((node) => [node.id, node]));
  const threadIds = map.threads.flatMap((thread) => [...thread.nodeIds, ...thread.testIds]);
  const ids = [...new Set([...threadIds, ...map.orphanIds])];
  return ids
    .flatMap((id) => {
      const node = byId.get(id);
      return node ? [node] : [];
    })
    .slice(0, NODE_LIMIT);
}

function refOf(index: number): string {
  return `c${index + 1}`;
}

function refToNodeId(nodes: ChangeNode[]): Map<string, string> {
  return new Map(nodes.map((node, index) => [refOf(index), node.id]));
}

function mappedDiffs(nodes: ChangeNode[], diffs: FileDiff[]): FileDiff[] {
  return diffs.flatMap((diff) => {
    const hunkIndexes = new Set(
      nodes.filter((node) => node.path === diff.path).flatMap((node) => node.hunkIndexes),
    );
    if (hunkIndexes.size === 0) return [];
    return [{ ...diff, hunks: diff.hunks.filter((_, index) => hunkIndexes.has(index)) }];
  });
}

function clippedDiff(diffs: FileDiff[]): string {
  const text = diffText(diffs);
  return text.length > DIFF_CHAR_BUDGET
    ? `${text.slice(0, DIFF_CHAR_BUDGET)}\n[diff truncated]`
    : text;
}

function nodeLines(nodes: ChangeNode[]): string {
  return nodes
    .map(
      (node, index) =>
        `- ${refOf(index)} | ${node.name ?? "file changes"} | ${node.path} | ${node.role} | ${node.kind}`,
    )
    .join("\n");
}

function buildChangePartsPrompt(input: ChangePartsInput, nodes: ChangeNode[]): string {
  return [
    fencedTitle(input.title),
    "## Changes",
    fenced("pr_changes", nodeLines(nodes)),
    "## Diff",
    fenced("pr_diff", clippedDiff(mappedDiffs(nodes, input.diffs))),
  ].join("\n");
}

function parseChangeParts(refs: Map<string, string>) {
  return (text: string) => {
    const parsed = ChangePartsSchema.parse(jsonObjectIn(text));
    const parts = parsed.parts.flatMap((part) => {
      const nodeId = refs.get(part.id);
      return nodeId ? [{ ...part, id: nodeId, part: part.part.slice(0, PART_LIMIT) }] : [];
    });
    return { parts };
  };
}

export async function describeChanges(
  input: ChangePartsInput,
  config: LlmConfig,
  fetchImpl: typeof fetch = fetch,
): Promise<ChangeParts> {
  const nodes = listedNodes(input.map);
  const request: ModelRequest = {
    system: SYSTEM_PROMPT,
    maxTokens: MAX_TOKENS,
    messages: [{ role: "user", content: buildChangePartsPrompt(input, nodes) }],
  };
  const result = await askForJson(
    { config, fetchImpl },
    request,
    parseChangeParts(refToNodeId(nodes)),
  );
  return { ...result, model: config.model };
}
