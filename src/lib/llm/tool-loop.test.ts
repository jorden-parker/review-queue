import { describe, expect, it, vi } from "vitest";
import type { AssistLookup } from "@/lib/assist-protocol";
import { type LlmClient, type Message, type ToolSpec } from "./client";
import {
  type LoopChunk,
  MAX_TOOL_CALLS_PER_ROUND,
  MAX_TOOL_ROUNDS,
  type ToolBox,
  type ToolOutcome,
  toolLoop,
} from "./tool-loop";

const CONFIG = {
  baseURL: "http://llm.test",
  model: "m",
  enabled: true,
  thinking: false,
  timeoutMs: 1000,
};

const SPEC: ToolSpec = {
  name: "find_references",
  description: "List uses of a name.",
  input_schema: { type: "object", properties: { name: { type: "string" } }, required: ["name"] },
};

const REQUEST = {
  system: "sys",
  maxTokens: 10,
  messages: [{ role: "user" as const, content: "who calls loadReview?" }],
};

function sse(type: string, data: object): string {
  return `event: ${type}\ndata: ${JSON.stringify({ type, ...data })}\n\n`;
}

function textRound(text: string): string {
  return (
    sse("content_block_start", { index: 0, content_block: { type: "text" } }) +
    sse("content_block_delta", { index: 0, delta: { type: "text_delta", text } }) +
    sse("content_block_stop", { index: 0 }) +
    sse("message_stop", {})
  );
}

function toolRound(id: string, input: object, leadingText = ""): string {
  const textBlock = leadingText
    ? sse("content_block_start", { index: 0, content_block: { type: "text" } }) +
      sse("content_block_delta", { index: 0, delta: { type: "text_delta", text: leadingText } }) +
      sse("content_block_stop", { index: 0 })
    : "";
  const index = leadingText ? 1 : 0;
  return (
    textBlock +
    sse("content_block_start", {
      index,
      content_block: { type: "tool_use", id, name: "find_references", input: {} },
    }) +
    sse("content_block_delta", {
      index,
      delta: { type: "input_json_delta", partial_json: JSON.stringify(input) },
    }) +
    sse("content_block_stop", { index }) +
    sse("message_delta", { delta: { stop_reason: "tool_use" } }) +
    sse("message_stop", {})
  );
}

function rawToolRound(id: string, partialJson: string): string {
  return (
    sse("content_block_start", {
      index: 0,
      content_block: { type: "tool_use", id, name: "find_references", input: {} },
    }) +
    sse("content_block_delta", {
      index: 0,
      delta: { type: "input_json_delta", partial_json: partialJson },
    }) +
    sse("content_block_stop", { index: 0 }) +
    sse("message_stop", {})
  );
}

function manyToolsRound(count: number): string {
  return (
    Array.from({ length: count }, (_, position) => {
      const index = position;
      return (
        sse("content_block_start", {
          index,
          content_block: {
            type: "tool_use",
            id: `m${position}`,
            name: "find_references",
            input: {},
          },
        }) +
        sse("content_block_delta", {
          index,
          delta: {
            type: "input_json_delta",
            partial_json: JSON.stringify({ name: `name${position}` }),
          },
        }) +
        sse("content_block_stop", { index })
      );
    }).join("") + sse("message_stop", {})
  );
}

function scriptedFetch(answers: Array<string | Response>) {
  const requests: Array<{ tools?: ToolSpec[]; messages: Message[] }> = [];
  let calls = 0;
  const fetchImpl = (async (_url: unknown, init?: RequestInit) => {
    requests.push(JSON.parse(String(init?.body)));
    const answer = answers[calls];
    calls += 1;
    if (answer instanceof Response) return answer;
    return new Response(new TextEncoder().encode(answer ?? textRound("")), {
      headers: { "content-type": "text/event-stream" },
    });
  }) as unknown as typeof fetch;
  return { fetchImpl, requests, calls: () => calls };
}

function lookupFor(name: string): AssistLookup {
  return { tool: "find_references", label: `Callers of \`${name}\` (1)`, paths: ["src/a.ts"] };
}

function toolBox(run?: (name: string, input: unknown) => Promise<ToolOutcome>): ToolBox {
  return {
    specs: [SPEC],
    run:
      run ??
      (async (_name, input) => ({
        content: `result for ${JSON.stringify(input)}`,
        lookup: lookupFor("loadReview"),
      })),
  };
}

async function drain(stream: AsyncIterable<LoopChunk>): Promise<LoopChunk[]> {
  const chunks: LoopChunk[] = [];
  for await (const chunk of stream) chunks.push(chunk);
  return chunks;
}

function textOf(chunks: LoopChunk[]): string {
  return chunks.map((chunk) => (chunk.kind === "text" ? chunk.text : "")).join("");
}

const client = (fetchImpl: typeof fetch): LlmClient => ({ config: CONFIG, fetchImpl });

describe("toolLoop", () => {
  it("runs a lookup, sends its result back, and streams the answer", async () => {
    const { fetchImpl, requests, calls } = scriptedFetch([
      toolRound("t1", { name: "loadReview" }),
      textRound("Only one caller."),
    ]);
    const run = vi.fn<ToolBox["run"]>(async () => ({
      content: "src/a.ts:3: loadReview()",
      lookup: lookupFor("loadReview"),
    }));
    const chunks = await drain(toolLoop(client(fetchImpl), REQUEST, toolBox(run)));

    expect(chunks).toEqual([
      { kind: "lookup", lookup: lookupFor("loadReview") },
      { kind: "text", text: "Only one caller." },
    ]);
    expect(run).toHaveBeenCalledWith("find_references", { name: "loadReview" });
    expect(calls()).toBe(2);
    expect(requests[0]?.tools).toEqual([SPEC]);
    expect(requests[1]?.messages).toEqual([
      REQUEST.messages[0],
      {
        role: "assistant",
        content: [
          { type: "tool_use", id: "t1", name: "find_references", input: { name: "loadReview" } },
        ],
      },
      {
        role: "user",
        content: [{ type: "tool_result", tool_use_id: "t1", content: "src/a.ts:3: loadReview()" }],
      },
    ]);
  });

  it("stops after MAX_TOOL_ROUNDS rounds of lookups without running the last round's tools", async () => {
    const answers = Array.from({ length: MAX_TOOL_ROUNDS }, (_, index) =>
      toolRound(`t${index}`, { name: "loadReview" }),
    );
    const { fetchImpl, calls } = scriptedFetch(answers);
    const run = vi.fn(toolBox().run);
    const chunks = await drain(toolLoop(client(fetchImpl), REQUEST, toolBox(run)));

    expect(calls()).toBe(MAX_TOOL_ROUNDS);
    expect(run).toHaveBeenCalledTimes(MAX_TOOL_ROUNDS - 1);
    expect(chunks.at(-1)).toEqual({
      kind: "text",
      text: `\n\n_Stopped after ${MAX_TOOL_ROUNDS} rounds of lookups._`,
    });
  });

  it("returns an error to the model as a failed tool_result and carries on", async () => {
    const { fetchImpl, requests } = scriptedFetch([
      toolRound("t1", { name: "loadReview" }),
      textRound("The lookup failed, so I cannot say."),
    ]);
    const failing = toolBox(async () => {
      throw new Error("boom");
    });
    const chunks = await drain(toolLoop(client(fetchImpl), REQUEST, failing));

    expect(chunks).toEqual([{ kind: "text", text: "The lookup failed, so I cannot say." }]);
    expect(requests[1]?.messages.at(-1)).toEqual({
      role: "user",
      content: [{ type: "tool_result", tool_use_id: "t1", content: "boom", is_error: true }],
    });
  });

  it("separates text from two rounds with a blank line", async () => {
    const { fetchImpl } = scriptedFetch([
      toolRound("t1", { name: "loadReview" }, "Checking."),
      textRound("Found it."),
    ]);
    const chunks = await drain(toolLoop(client(fetchImpl), REQUEST, toolBox()));

    expect(textOf(chunks)).toBe("Checking.\n\nFound it.");
  });

  it("answers without tools when the model does not support them", async () => {
    const unsupported = new Response(
      JSON.stringify({
        error: { message: "registry.ollama.ai/library/x does not support tools" },
      }),
      { status: 400 },
    );
    const { fetchImpl, requests, calls } = scriptedFetch([unsupported, textRound("Plain answer.")]);
    const chunks = await drain(toolLoop(client(fetchImpl), REQUEST, toolBox()));

    expect(chunks).toEqual([{ kind: "text", text: "Plain answer." }]);
    expect(calls()).toBe(2);
    expect(requests[1]).not.toHaveProperty("tools");
  });

  it("propagates other model errors", async () => {
    const broken = new Response(JSON.stringify({ error: { message: "overloaded" } }), {
      status: 500,
    });
    const { fetchImpl } = scriptedFetch([broken]);
    await expect(drain(toolLoop(client(fetchImpl), REQUEST, toolBox()))).rejects.toThrow(
      "LLM request failed (HTTP 500): overloaded",
    );
  });

  it("returns malformed tool input as an error result and keeps answering", async () => {
    const { fetchImpl, requests } = scriptedFetch([
      rawToolRound("t1", '{"name":'),
      textRound("Retrying without that lookup."),
    ]);
    const run = vi.fn<ToolBox["run"]>(async (_name, input) => {
      if (typeof input === "object" && input !== null && "invalid_json" in input) {
        throw new Error("name is required");
      }
      return { content: "ok", lookup: lookupFor("loadReview") };
    });
    const chunks = await drain(toolLoop(client(fetchImpl), REQUEST, toolBox(run)));

    expect(textOf(chunks)).toBe("Retrying without that lookup.");
    expect(requests[1]?.messages.at(-1)).toEqual({
      role: "user",
      content: [
        { type: "tool_result", tool_use_id: "t1", content: "name is required", is_error: true },
      ],
    });
  });

  it("runs at most MAX_TOOL_CALLS_PER_ROUND calls and skips the rest with an error result", async () => {
    const extra = MAX_TOOL_CALLS_PER_ROUND + 1;
    const { fetchImpl, requests } = scriptedFetch([manyToolsRound(extra), textRound("Done.")]);
    const run = vi.fn(toolBox().run);
    const chunks = await drain(toolLoop(client(fetchImpl), REQUEST, toolBox(run)));

    expect(run).toHaveBeenCalledTimes(MAX_TOOL_CALLS_PER_ROUND);
    expect(chunks.filter((chunk) => chunk.kind === "lookup")).toHaveLength(
      MAX_TOOL_CALLS_PER_ROUND,
    );
    const results = requests[1]?.messages.at(-1)?.content;
    expect(results).toHaveLength(extra);
    expect(results?.at(-1)).toEqual({
      type: "tool_result",
      tool_use_id: `m${MAX_TOOL_CALLS_PER_ROUND}`,
      content: `Skipped: at most ${MAX_TOOL_CALLS_PER_ROUND} lookups per round.`,
      is_error: true,
    });
  });
});
