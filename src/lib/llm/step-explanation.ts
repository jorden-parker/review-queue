import { z } from "zod";
import type { FileDiff, Step } from "@/lib/types";
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
import { reviewGuidance } from "./review-guidance";

export type StepExplanationInput = {
  title: string;
  step: Step;
  diffs: FileDiff[];
};

const DIFF_CHAR_BUDGET = 24_000;
const MAX_TOKENS = 600;
const CHECK_LIMIT = 3;

const StepExplanationSchema = z.object({
  what: z.string(),
  checks: z.array(z.string()).default([]),
});

export const StepExplanationRecordSchema = StepExplanationSchema.extend({ model: z.string() });

export type StepExplanation = z.infer<typeof StepExplanationRecordSchema>;

const BASE_PROMPT = `You help a reviewer with ADHD understand one step of a pull request. Be brief, concrete and calm.
Reply with ONLY a JSON object, no prose and no code fences, matching:
{"what": "2-3 plain sentences on what this step changes and why it matters",
 "checks": ["up to 3 specific things to verify in these lines, including design problems where present"]}
${UNTRUSTED_DATA_RULE}
${CODE_NAME_RULE}`;

function systemPrompt(input: StepExplanationInput): string {
  const paths = input.step.files.map((file) => file.path);
  return [BASE_PROMPT, reviewGuidance(paths)].join("\n\n");
}

export function stepDiffs(step: Step, diffs: FileDiff[]): FileDiff[] {
  const stepPaths = new Set(step.files.map((file) => file.path));
  return diffs
    .filter((diff) => stepPaths.has(diff.path))
    .map((diff) => {
      const hunkIndexes = new Set(
        step.files.find((file) => file.path === diff.path)?.hunkIndexes ?? [],
      );
      return { ...diff, hunks: diff.hunks.filter((_, index) => hunkIndexes.has(index)) };
    });
}

function clippedDiff(diffs: FileDiff[]): string {
  const text = diffText(diffs);
  return text.length > DIFF_CHAR_BUDGET
    ? `${text.slice(0, DIFF_CHAR_BUDGET)}\n[diff truncated]`
    : text;
}

export function buildStepPrompt(input: StepExplanationInput): string {
  const { step } = input;
  return [
    "# Step",
    fenced("pr_step", `${step.title} | ${step.role}\n${step.reason}`),
    fencedTitle(input.title),
    "## Diff",
    fenced("pr_diff", clippedDiff(stepDiffs(step, input.diffs))),
  ].join("\n");
}

function parseExplanation(text: string) {
  const parsed = StepExplanationSchema.parse(jsonObjectIn(text));
  return { ...parsed, checks: parsed.checks.slice(0, CHECK_LIMIT) };
}

export async function explainStep(
  input: StepExplanationInput,
  config: LlmConfig,
  fetchImpl: typeof fetch = fetch,
): Promise<StepExplanation> {
  const request: ModelRequest = {
    system: systemPrompt(input),
    maxTokens: MAX_TOKENS,
    messages: [{ role: "user", content: buildStepPrompt(input) }],
  };
  const explanation = await askForJson({ config, fetchImpl }, request, parseExplanation);
  return { ...explanation, model: config.model };
}
