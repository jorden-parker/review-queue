import { describe, expect, it } from "vitest";
import { askModel, llmConfigFromEnv, streamModel, streamTurn } from "./client";

const CONFIG = {
  baseURL: "http://llm.test",
  model: "m",
  enabled: true,
  thinking: true,
  timeoutMs: 1000,
};

function recordingFetch() {
  const bodies: unknown[] = [];
  const fetchImpl = async (_url: unknown, init?: RequestInit) => {
    bodies.push(JSON.parse(String(init?.body)));
    return Response.json({ content: [{ type: "text", text: "ok" }] });
  };
  return { fetchImpl: fetchImpl as typeof fetch, bodies };
}

describe("llmConfigFromEnv", () => {
  it("defaults to local Ollama and can be switched off", () => {
    expect(llmConfigFromEnv({})).toMatchObject({
      baseURL: "http://localhost:11434",
      model: "qwen3.8-27b-cc",
      enabled: true,
      thinking: true,
    });
    expect(llmConfigFromEnv({ REVIEW_QUEUE_LLM: "off" }).enabled).toBe(false);
  });

  it("lets thinking be switched off", () => {
    expect(llmConfigFromEnv({ REVIEW_QUEUE_LLM_THINKING: "off" }).thinking).toBe(false);
  });
});

describe("askModel", () => {
  it("sends the request's system prompt, token cap with room to think, and messages", async () => {
    const { fetchImpl, bodies } = recordingFetch();
    const reply = await askModel(
      { config: CONFIG, fetchImpl },
      { system: "sys", maxTokens: 42, messages: [{ role: "user", content: "hi" }] },
    );
    expect(reply).toBe("ok");
    expect(bodies[0]).toMatchObject({
      model: "m",
      system: "sys",
      max_tokens: 42 + 2048,
      messages: [{ role: "user", content: "hi" }],
      temperature: 0,
      stream: false,
    });
    expect(bodies[0]).not.toHaveProperty("thinking");
  });

  it("asks the model not to think, without the extra tokens, when thinking is off", async () => {
    const { fetchImpl, bodies } = recordingFetch();
    await askModel(
      { config: { ...CONFIG, thinking: false }, fetchImpl },
      { system: "sys", maxTokens: 42, messages: [{ role: "user", content: "hi" }] },
    );
    expect(bodies[0]).toMatchObject({ max_tokens: 42, thinking: { type: "disabled" } });
  });
});

function sseEvent(type: string, data: object): string {
  return `event: ${type}\ndata: ${JSON.stringify({ type, ...data })}\n\n`;
}

function streamingFetch(chunks: string[]) {
  const bodies: unknown[] = [];
  const fetchImpl = async (_url: unknown, init?: RequestInit) => {
    bodies.push(JSON.parse(String(init?.body)));
    const encoder = new TextEncoder();
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        for (const chunk of chunks) controller.enqueue(encoder.encode(chunk));
        controller.close();
      },
    });
    return new Response(body, { headers: { "content-type": "text/event-stream" } });
  };
  return { fetchImpl: fetchImpl as typeof fetch, bodies };
}

async function collect<T>(stream: AsyncIterable<T>): Promise<T[]> {
  const parts: T[] = [];
  for await (const part of stream) parts.push(part);
  return parts;
}

const REQUEST = {
  system: "sys",
  maxTokens: 10,
  messages: [{ role: "user" as const, content: "hi" }],
};

describe("streamModel", () => {
  it("yields text deltas, even when events are split across chunks", async () => {
    const events =
      sseEvent("message_start", { message: {} }) +
      sseEvent("content_block_delta", { index: 0, delta: { type: "text_delta", text: "Hel" } }) +
      sseEvent("content_block_delta", { index: 0, delta: { type: "text_delta", text: "lo" } }) +
      sseEvent("message_stop", {});
    const { fetchImpl, bodies } = streamingFetch([events.slice(0, 70), events.slice(70)]);
    const parts = await collect(streamModel({ config: CONFIG, fetchImpl }, REQUEST));
    expect(parts.join("")).toBe("Hello");
    expect(bodies[0]).toMatchObject({ stream: true, system: "sys", max_tokens: 10 + 2048 });
  });

  it("drops the model's thinking and yields only its answer", async () => {
    const events =
      sseEvent("content_block_delta", {
        index: 0,
        delta: { type: "thinking_delta", thinking: "Draft" },
      }) +
      sseEvent("content_block_delta", { index: 1, delta: { type: "text_delta", text: "Answer" } });
    const { fetchImpl } = streamingFetch([events]);
    const parts = await collect(streamModel({ config: CONFIG, fetchImpl }, REQUEST));
    expect(parts.join("")).toBe("Answer");
  });

  it("gives up when the model does not start answering in time", async () => {
    const hanging = (async (_url: unknown, init?: RequestInit) =>
      new Promise((_resolve, reject) =>
        init?.signal?.addEventListener("abort", () => reject(init.signal?.reason)),
      )) as unknown as typeof fetch;
    const config = { ...CONFIG, timeoutMs: 20 };
    await expect(collect(streamModel({ config, fetchImpl: hanging }, REQUEST))).rejects.toThrow(
      /timeout|too long/i,
    );
  });

  it("keeps streaming past the timeout once the answer has started", async () => {
    const encoder = new TextEncoder();
    const delta = (text: string) =>
      encoder.encode(sseEvent("content_block_delta", { delta: { type: "text_delta", text } }));
    const slowBody = (async (_url: unknown, init?: RequestInit) => {
      const body = new ReadableStream<Uint8Array>({
        async start(controller) {
          controller.enqueue(delta("a"));
          await new Promise((resolve) => setTimeout(resolve, 60));
          if (init?.signal?.aborted) return controller.error(init.signal.reason);
          controller.enqueue(delta("b"));
          controller.close();
        },
      });
      return new Response(body);
    }) as unknown as typeof fetch;
    const config = { ...CONFIG, timeoutMs: 20 };
    const parts = await collect(streamModel({ config, fetchImpl: slowBody }, REQUEST));
    expect(parts.join("")).toBe("ab");
  });

  it("reports a missing model", async () => {
    const fetchImpl = (async () => new Response("", { status: 404 })) as unknown as typeof fetch;
    await expect(collect(streamModel({ config: CONFIG, fetchImpl }, REQUEST))).rejects.toThrow(
      'Model "m" is not installed',
    );
  });

  it("raises an error event from the server", async () => {
    const { fetchImpl } = streamingFetch([sseEvent("error", { error: { message: "overloaded" } })]);
    await expect(collect(streamModel({ config: CONFIG, fetchImpl }, REQUEST))).rejects.toThrow(
      "overloaded",
    );
  });
});

describe("streamTurn", () => {
  it("yields a tool_use block whose input arrives in split JSON chunks", async () => {
    const events =
      sseEvent("content_block_start", {
        index: 0,
        content_block: { type: "tool_use", id: "t1", name: "find_references", input: {} },
      }) +
      sseEvent("content_block_delta", {
        index: 0,
        delta: { type: "input_json_delta", partial_json: '{"name":' },
      }) +
      sseEvent("content_block_delta", {
        index: 0,
        delta: { type: "input_json_delta", partial_json: '"loadReview"}' },
      }) +
      sseEvent("content_block_stop", { index: 0 }) +
      sseEvent("message_stop", {});
    const { fetchImpl } = streamingFetch([events]);
    const turn = await collect(streamTurn({ config: CONFIG, fetchImpl }, REQUEST));
    expect(turn).toEqual([
      { type: "tool_use", id: "t1", name: "find_references", input: { name: "loadReview" } },
    ]);
  });

  it("yields text and tool calls in stream order", async () => {
    const events =
      sseEvent("content_block_start", { index: 0, content_block: { type: "text" } }) +
      sseEvent("content_block_delta", {
        index: 0,
        delta: { type: "text_delta", text: "Let me look." },
      }) +
      sseEvent("content_block_stop", { index: 0 }) +
      sseEvent("content_block_start", {
        index: 1,
        content_block: { type: "tool_use", id: "t2", name: "read_file", input: {} },
      }) +
      sseEvent("content_block_delta", {
        index: 1,
        delta: { type: "input_json_delta", partial_json: '{"path":"src/a.ts"}' },
      }) +
      sseEvent("content_block_stop", { index: 1 });
    const { fetchImpl } = streamingFetch([events]);
    const turn = await collect(streamTurn({ config: CONFIG, fetchImpl }, REQUEST));
    expect(turn).toEqual([
      { type: "text", text: "Let me look." },
      { type: "tool_use", id: "t2", name: "read_file", input: { path: "src/a.ts" } },
    ]);
  });

  it("ignores thinking blocks and their deltas", async () => {
    const events =
      sseEvent("content_block_start", { index: 0, content_block: { type: "thinking" } }) +
      sseEvent("content_block_delta", {
        index: 0,
        delta: { type: "thinking_delta", thinking: "Draft" },
      }) +
      sseEvent("content_block_stop", { index: 0 }) +
      sseEvent("content_block_delta", { index: 1, delta: { type: "text_delta", text: "Answer" } });
    const { fetchImpl } = streamingFetch([events]);
    const turn = await collect(streamTurn({ config: CONFIG, fetchImpl }, REQUEST));
    expect(turn).toEqual([{ type: "text", text: "Answer" }]);
  });

  it("sends tools in the request body only when the request sets them", async () => {
    const tools = [
      {
        name: "find_references",
        description: "List uses of a name.",
        input_schema: { type: "object", properties: {} },
      },
    ];
    const withTools = streamingFetch([sseEvent("message_stop", {})]);
    await collect(
      streamTurn({ config: CONFIG, fetchImpl: withTools.fetchImpl }, { ...REQUEST, tools }),
    );
    expect(withTools.bodies[0]).toMatchObject({ tools });

    const withoutTools = streamingFetch([sseEvent("message_stop", {})]);
    await collect(streamTurn({ config: CONFIG, fetchImpl: withoutTools.fetchImpl }, REQUEST));
    expect(withoutTools.bodies[0]).not.toHaveProperty("tools");
  });
});
