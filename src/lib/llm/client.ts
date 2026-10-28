import type { FileDiff } from "@/lib/types";

export type LlmConfig = {
  baseURL: string;
  model: string;
  enabled: boolean;
  thinking: boolean;
  timeoutMs: number;
};

export type LlmClient = { config: LlmConfig; fetchImpl: typeof fetch };

export type ToolSpec = { name: string; description: string; input_schema: Record<string, unknown> };

export type TextBlock = { type: "text"; text: string };

export type ToolUseBlock = { type: "tool_use"; id: string; name: string; input: unknown };

export type ToolResultBlock = {
  type: "tool_result";
  tool_use_id: string;
  content: string;
  is_error?: boolean;
};

export type ContentBlock = TextBlock | ToolUseBlock | ToolResultBlock;

export type Message = { role: "user" | "assistant"; content: string | ContentBlock[] };

export type ModelRequest = {
  system: string;
  maxTokens: number;
  messages: Message[];
  tools?: ToolSpec[];
};

export type TurnEvent = { type: "text"; text: string } | ToolUseBlock;

const THINKING_TOKENS = 2048;

export const CODE_NAME_RULE =
  "Write markdown, and wrap every function, method, variable, type, file and other identifier name in backticks, like `loadReview`.";

const DEFAULT_TIMEOUT_MS = 180_000;

export function llmConfigFromEnv(env: Record<string, string | undefined> = process.env): LlmConfig {
  return {
    baseURL: env.REVIEW_QUEUE_LLM_URL ?? env.OLLAMA_HOST ?? "http://localhost:11434",
    model: env.REVIEW_QUEUE_LLM_MODEL ?? "qwen3.8-27b-cc",
    enabled: env.REVIEW_QUEUE_LLM !== "off",
    thinking: env.REVIEW_QUEUE_LLM_THINKING !== "off",
    timeoutMs: Number(env.REVIEW_QUEUE_LLM_TIMEOUT_MS ?? DEFAULT_TIMEOUT_MS),
  };
}

export function diffText(diffs: FileDiff[]): string {
  return diffs
    .filter((diff) => !diff.binary)
    .map((diff) => {
      const body = diff.hunks
        .map((hunk) =>
          hunk.lines
            .map(
              (line) =>
                `${line.kind === "add" ? "+" : line.kind === "del" ? "-" : " "}${line.text}`,
            )
            .join("\n"),
        )
        .join("\n");
      return `--- ${diff.path} (${diff.status})\n${body}`;
    })
    .join("\n\n");
}

export function fenced(tag: string, text: string): string {
  const neutralized = text.replace(/<(?=\/?pr_)/gi, "&lt;");
  return `<${tag}>\n${neutralized}\n</${tag}>`;
}

export function jsonObjectIn(text: string): unknown {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end <= start) throw new Error("No JSON object in reply");
  return JSON.parse(text.slice(start, end + 1));
}

async function serverMessage(response: Response): Promise<string> {
  const body = (await response.json().catch(() => null)) as { error?: { message?: string } } | null;
  return body?.error?.message ?? "no details";
}

async function failureMessage(response: Response, model: string): Promise<string> {
  if (response.status === 404) return `Model "${model}" is not installed (HTTP 404)`;
  return `LLM request failed (HTTP ${response.status}): ${await serverMessage(response)}`;
}

type Deadline = { signal: AbortSignal; release: () => void };

function wholeRequestDeadline(timeoutMs: number): Deadline {
  return { signal: AbortSignal.timeout(timeoutMs), release: () => {} };
}

function firstResponseDeadline(timeoutMs: number): Deadline {
  const controller = new AbortController();
  const timer = setTimeout(
    () =>
      controller.abort(
        new DOMException("The model took too long to start answering", "TimeoutError"),
      ),
    timeoutMs,
  );
  return { signal: controller.signal, release: () => clearTimeout(timer) };
}

function thinkingFields(config: LlmConfig, maxTokens: number) {
  return config.thinking
    ? { max_tokens: maxTokens + THINKING_TOKENS }
    : { max_tokens: maxTokens, thinking: { type: "disabled" } };
}

async function postMessages(
  client: LlmClient,
  request: ModelRequest,
  stream: boolean,
  signal?: AbortSignal,
): Promise<Response> {
  const deadline = stream
    ? firstResponseDeadline(client.config.timeoutMs)
    : wholeRequestDeadline(client.config.timeoutMs);
  const response = await client
    .fetchImpl(`${client.config.baseURL}/v1/messages`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": "local",
        authorization: "Bearer local",
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: client.config.model,
        ...thinkingFields(client.config, request.maxTokens),
        temperature: 0,
        stream,
        system: request.system,
        messages: request.messages,
        ...(request.tools ? { tools: request.tools } : {}),
      }),
      signal: signal ? AbortSignal.any([deadline.signal, signal]) : deadline.signal,
    })
    .finally(deadline.release);
  if (!response.ok) throw new Error(await failureMessage(response, client.config.model));
  return response;
}

export async function askModel(client: LlmClient, request: ModelRequest): Promise<string> {
  const response = await postMessages(client, request, false);
  const reply = (await response.json()) as { content?: { type: string; text?: string }[] };
  return (reply.content ?? [])
    .map((block) => (block.type === "text" ? (block.text ?? "") : ""))
    .join("");
}

type StreamEvent = {
  type?: string;
  index?: number;
  content_block?: { type?: string; id?: string; name?: string };
  delta?: { type?: string; text?: string; partial_json?: string };
  error?: { message?: string };
};

type PendingToolUse = { id: string; name: string; json: string };

function parseEvent(rawEvent: string): StreamEvent | null {
  const data = rawEvent
    .split("\n")
    .filter((line) => line.startsWith("data:"))
    .map((line) => line.slice(5).trim())
    .join("");
  if (!data) return null;
  const event = JSON.parse(data) as StreamEvent;
  if (event.type === "error") throw new Error(event.error?.message ?? "LLM stream failed");
  return event;
}

function parseEvents(rawEvents: string[]): StreamEvent[] {
  return rawEvents.map(parseEvent).filter((event): event is StreamEvent => event !== null);
}

async function* textChunks(body: ReadableStream<Uint8Array>): AsyncGenerator<string> {
  const decoder = new TextDecoder();
  const reader = body.getReader();
  for (let read = await reader.read(); !read.done; read = await reader.read()) {
    yield decoder.decode(read.value, { stream: true });
  }
}

async function* streamEvents(body: ReadableStream<Uint8Array>): AsyncGenerator<StreamEvent> {
  let pending = "";
  for await (const chunk of textChunks(body)) {
    const rawEvents = (pending + chunk).replaceAll("\r\n", "\n").split("\n\n");
    pending = rawEvents.pop() ?? "";
    yield* parseEvents(rawEvents);
  }
  yield* parseEvents([pending]);
}

function startToolBlock(event: StreamEvent, toolBlocks: Map<number, PendingToolUse>): void {
  if (event.content_block?.type !== "tool_use") return;
  toolBlocks.set(event.index ?? 0, {
    id: event.content_block.id ?? "",
    name: event.content_block.name ?? "",
    json: "",
  });
}

function appendToolJson(event: StreamEvent, toolBlocks: Map<number, PendingToolUse>): void {
  const block = toolBlocks.get(event.index ?? 0);
  if (block) block.json += event.delta?.partial_json ?? "";
}

function finishToolBlock(
  event: StreamEvent,
  toolBlocks: Map<number, PendingToolUse>,
): ToolUseBlock | null {
  const index = event.index ?? 0;
  const block = toolBlocks.get(index);
  if (!block) return null;
  toolBlocks.delete(index);
  return {
    type: "tool_use",
    id: block.id,
    name: block.name,
    input: JSON.parse(block.json || "{}"),
  };
}

function textEventOf(event: StreamEvent): TurnEvent | null {
  if (event.type !== "content_block_delta" || event.delta?.type !== "text_delta") return null;
  return event.delta.text ? { type: "text", text: event.delta.text } : null;
}

function turnEventOf(
  event: StreamEvent,
  toolBlocks: Map<number, PendingToolUse>,
): TurnEvent | null {
  if (event.type === "content_block_start") startToolBlock(event, toolBlocks);
  if (event.type === "content_block_stop") return finishToolBlock(event, toolBlocks);
  if (event.type === "content_block_delta" && event.delta?.type === "input_json_delta") {
    appendToolJson(event, toolBlocks);
    return null;
  }
  return textEventOf(event);
}

export async function* streamTurn(
  client: LlmClient,
  request: ModelRequest,
  signal?: AbortSignal,
): AsyncGenerator<TurnEvent> {
  const response = await postMessages(client, request, true, signal);
  if (!response.body) return;
  const toolBlocks = new Map<number, PendingToolUse>();
  for await (const event of streamEvents(response.body)) {
    const turnEvent = turnEventOf(event, toolBlocks);
    if (turnEvent) yield turnEvent;
  }
}

export async function* streamModel(
  client: LlmClient,
  request: ModelRequest,
  signal?: AbortSignal,
): AsyncGenerator<string> {
  for await (const event of streamTurn(client, request, signal)) {
    if (event.type === "text") yield event.text;
  }
}

export async function askForJson<T>(
  client: LlmClient,
  request: ModelRequest,
  parse: (text: string) => T,
): Promise<T> {
  const first = await askModel(client, request);
  try {
    return parse(first);
  } catch (error) {
    const retry = await askModel(client, {
      ...request,
      messages: [
        ...request.messages,
        { role: "assistant", content: first },
        {
          role: "user",
          content: `That was not valid JSON for the schema (${String(error)}). Reply with only the JSON object.`,
        },
      ],
    });
    return parse(retry);
  }
}
