import { z } from "zod";
import {
  ASSIST_ACTIONS,
  type AssistAction,
  isBefore,
  type LinePosition,
  linesInRange,
  MAX_HISTORY_TURNS,
  targetPath,
} from "@/lib/assist-protocol";
import { checksFor } from "@/lib/hotspots/checks";
import type { AssistFlag, AssistInput } from "@/lib/llm/assist";
import type { Message } from "@/lib/llm/client";
import type { SuggestedHotspot } from "@/lib/llm/orientation";
import { type StepExplanation, stepDiffs } from "@/lib/llm/step-explanation";
import type { SymbolIndex } from "@/lib/symbols/symbol-index";
import type { DiffLine, Hotspot, Hunk } from "@/lib/types";
import type { PreparedFile, ReviewData } from "./prepare";

const PositionSchema = z.object({
  hunk: z.number().int().nonnegative(),
  line: z.number().int().nonnegative(),
});

const MessageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().min(1).max(8_000),
});

function alternatesFromModel(history: Message[]): boolean {
  return history.every(
    (message, index) => message.role === (index % 2 === 0 ? "assistant" : "user"),
  );
}

const HistorySchema = z
  .array(MessageSchema)
  .max(MAX_HISTORY_TURNS)
  .refine(
    (history) => history.length % 2 === 0 && alternatesFromModel(history),
    "History must alternate model and reviewer turns, ending with the reviewer",
  );

export const AssistTargetSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("lines"),
    range: z.object({ path: z.string().min(1), from: PositionSchema, to: PositionSchema }),
  }),
  z.object({ kind: z.literal("file"), path: z.string().min(1) }),
  z.object({
    kind: z.literal("check"),
    stepId: z.string().min(1),
    check: z.number().int().nonnegative(),
    path: z.string().min(1),
  }),
]);

export const AssistRequestSchema = z.object({
  action: z.enum(ASSIST_ACTIONS),
  target: AssistTargetSchema,
  question: z.string().trim().min(1).max(2_000).nullable(),
  history: HistorySchema,
});

export type AssistRequest = z.infer<typeof AssistRequestSchema>;

export type AssistSource = {
  data: ReviewData;
  index: Pick<SymbolIndex, "readFile">;
  explanationOf: (stepId: string) => StepExplanation | null;
  suggestedHotspots: () => SuggestedHotspot[];
};

type AssistInputResult = { ok: true; input: AssistInput } | { ok: false; error: string };

type TargetContent = Pick<AssistInput, "scope" | "context" | "selected" | "fileText" | "stepCheck">;

type CheckTarget = Extract<AssistRequest["target"], { kind: "check" }>;

type ContentResult = { ok: true; content: TargetContent } | { ok: false; error: string };

function hasLine(hunks: Hunk[], position: LinePosition): boolean {
  return position.line < (hunks[position.hunk]?.lines.length ?? 0);
}

function lineContent(file: PreparedFile, from: LinePosition, to: LinePosition): ContentResult {
  if (!hasLine(file.hunks, from) || !hasLine(file.hunks, to) || isBefore(to, from))
    return { ok: false, error: "Those lines are not in this diff" };
  return {
    ok: true,
    content: {
      scope: "lines",
      context: file.hunks.slice(from.hunk, to.hunk + 1),
      selected: linesInRange(file.hunks, from, to),
      fileText: null,
      stepCheck: null,
    },
  };
}

function headText(index: AssistSource["index"], file: PreparedFile): string | null {
  if (file.status === "deleted") return null;
  try {
    return index.readFile(file.path);
  } catch {
    return null;
  }
}

function fileContent(index: AssistSource["index"], file: PreparedFile): ContentResult {
  if (file.binary) return { ok: false, error: "Binary files cannot be sent to the model" };
  return {
    ok: true,
    content: {
      scope: "file",
      context: file.hunks,
      selected: [],
      fileText: headText(index, file),
      stepCheck: null,
    },
  };
}

function checkContent(
  source: AssistSource,
  action: AssistAction,
  target: CheckTarget,
): ContentResult {
  if (action !== "explain" && action !== "ask")
    return { ok: false, error: "Only explain and ask work on a step check" };
  const step = source.data.steps.find((candidate) => candidate.id === target.stepId);
  if (!step) return { ok: false, error: "Unknown step" };
  if (!step.files.some((file) => file.path === target.path))
    return { ok: false, error: "That file is not in this step" };
  const explanation = source.explanationOf(target.stepId);
  if (!explanation) return { ok: false, error: "Open the step again to get its explanation" };
  const text = explanation.checks[target.check];
  if (text === undefined) return { ok: false, error: "That check is not in the step explanation" };
  return {
    ok: true,
    content: {
      scope: "check",
      context: [],
      selected: [],
      fileText: null,
      stepCheck: { step, text, diffs: stepDiffs(step, source.data.files) },
    },
  };
}

function contentFor(
  source: AssistSource,
  request: AssistRequest,
  file: PreparedFile,
): ContentResult {
  const { target } = request;
  if (target.kind === "check") return checkContent(source, request.action, target);
  if (target.kind === "lines") return lineContent(file, target.range.from, target.range.to);
  return fileContent(source.index, file);
}

const SUGGESTED_RULE = "ai";

function flagsOn(source: AssistSource, path: string, selected: DiffLine[]): AssistFlag[] {
  const lines = new Set(selected.map((line) => line.newLine));
  const onSelectedLines = (hotspot: Hotspot | SuggestedHotspot) =>
    hotspot.path === path && lines.has(hotspot.line ?? null);
  const found = source.data.hotspots.filter(onSelectedLines).map((hotspot) => ({
    title: hotspot.title,
    why: hotspot.why,
    checks: checksFor(hotspot.rule),
  }));
  const suggested = source
    .suggestedHotspots()
    .filter(onSelectedLines)
    .map((hotspot) => ({
      title: hotspot.title,
      why: hotspot.why,
      checks: checksFor(SUGGESTED_RULE),
    }));
  return [...found, ...suggested];
}

export function assistInputFrom(source: AssistSource, request: AssistRequest): AssistInputResult {
  const { target } = request;
  const file = source.data.files.find((candidate) => candidate.path === targetPath(target));
  if (!file) return { ok: false, error: "That file is not in this review" };
  const result = contentFor(source, request, file);
  if (!result.ok) return result;
  const flags =
    request.action === "check" ? flagsOn(source, file.path, result.content.selected) : [];
  if (request.action === "check" && flags.length === 0)
    return { ok: false, error: "Those lines have no flags" };
  return {
    ok: true,
    input: {
      title: source.data.pr.title,
      path: file.path,
      action: request.action,
      question: request.question,
      flags,
      ...result.content,
    },
  };
}
