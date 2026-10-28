import type { AssistLookup } from "@/lib/assist-protocol";
import {
  type ContentBlock,
  type LlmClient,
  type Message,
  type ModelRequest,
  type ToolResultBlock,
  type ToolSpec,
  type ToolUseBlock,
  streamTurn,
} from "./client";

export type ToolOutcome = { content: string; lookup: AssistLookup };

export type ToolBox = {
  specs: ToolSpec[];
  run: (name: string, input: unknown) => Promise<ToolOutcome>;
};

export type LoopChunk = { kind: "text"; text: string } | { kind: "lookup"; lookup: AssistLookup };

export const MAX_TOOL_ROUNDS = 5;

const ROUND_SEPARATOR = "\n\n";

type RoundOutcome = { text: string; toolUses: ToolUseBlock[] };

function isToolsUnsupported(error: unknown): boolean {
  return error instanceof Error && /does not support tools/i.test(error.message);
}

async function* streamRound(
  client: LlmClient,
  request: ModelRequest,
  signal: AbortSignal | undefined,
  separateFromEarlierText: boolean,
): AsyncGenerator<LoopChunk, RoundOutcome> {
  let text = "";
  const toolUses: ToolUseBlock[] = [];
  for await (const event of streamTurn(client, request, signal)) {
    if (event.type === "tool_use") {
      toolUses.push(event);
      continue;
    }
    if (separateFromEarlierText && text === "") yield { kind: "text", text: ROUND_SEPARATOR };
    text += event.text;
    yield { kind: "text", text: event.text };
  }
  return { text, toolUses };
}

async function* answerRound(
  client: LlmClient,
  request: ModelRequest,
  tools: ToolBox,
  signal: AbortSignal | undefined,
  separateFromEarlierText: boolean,
): AsyncGenerator<LoopChunk, RoundOutcome> {
  try {
    return yield* streamRound(
      client,
      { ...request, tools: tools.specs },
      signal,
      separateFromEarlierText,
    );
  } catch (error) {
    if (!isToolsUnsupported(error)) throw error;
    return yield* streamRound(client, request, signal, separateFromEarlierText);
  }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function resultBlock(toolUseId: string, content: string, failed: boolean): ToolResultBlock {
  return failed
    ? { type: "tool_result", tool_use_id: toolUseId, content, is_error: true }
    : { type: "tool_result", tool_use_id: toolUseId, content };
}

async function runOne(
  toolUse: ToolUseBlock,
  tools: ToolBox,
): Promise<{ result: ToolResultBlock; lookup: AssistLookup | null }> {
  try {
    const outcome = await tools.run(toolUse.name, toolUse.input);
    return { result: resultBlock(toolUse.id, outcome.content, false), lookup: outcome.lookup };
  } catch (error) {
    return { result: resultBlock(toolUse.id, errorMessage(error), true), lookup: null };
  }
}

async function* runTools(
  toolUses: ToolUseBlock[],
  tools: ToolBox,
): AsyncGenerator<LoopChunk, ToolResultBlock[]> {
  const results: ToolResultBlock[] = [];
  for (const toolUse of toolUses) {
    const { result, lookup } = await runOne(toolUse, tools);
    if (lookup) yield { kind: "lookup", lookup };
    results.push(result);
  }
  return results;
}

function assistantTurn(outcome: RoundOutcome): Message {
  const textBlocks: ContentBlock[] = outcome.text ? [{ type: "text", text: outcome.text }] : [];
  return { role: "assistant", content: [...textBlocks, ...outcome.toolUses] };
}

export async function* toolLoop(
  client: LlmClient,
  request: ModelRequest,
  tools: ToolBox,
  signal?: AbortSignal,
): AsyncGenerator<LoopChunk> {
  let messages = request.messages;
  let hasShownText = false;
  for (let round = 1; round <= MAX_TOOL_ROUNDS; round += 1) {
    const outcome: RoundOutcome = yield* answerRound(
      client,
      { ...request, messages },
      tools,
      signal,
      hasShownText,
    );
    hasShownText ||= outcome.text !== "";
    if (outcome.toolUses.length === 0) return;
    if (round === MAX_TOOL_ROUNDS) {
      yield {
        kind: "text",
        text: `${ROUND_SEPARATOR}_Stopped after ${MAX_TOOL_ROUNDS} rounds of lookups._`,
      };
      return;
    }
    const results = yield* runTools(outcome.toolUses, tools);
    messages = [...messages, assistantTurn(outcome), { role: "user", content: results }];
  }
}
