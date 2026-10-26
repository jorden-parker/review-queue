import type { FileDiff } from "@/lib/types";

export type LlmConfig = { baseURL: string; model: string; enabled: boolean; timeoutMs: number };

export type LlmClient = { config: LlmConfig; fetchImpl: typeof fetch };

export type Message = { role: "user" | "assistant"; content: string };

export type ModelRequest = { system: string; maxTokens: number; messages: Message[] };

const DEFAULT_TIMEOUT_MS = 180_000;

export function llmConfigFromEnv(env: Record<string, string | undefined> = process.env): LlmConfig {
  return {
    baseURL: env.REVIEW_QUEUE_LLM_URL ?? env.OLLAMA_HOST ?? "http://localhost:11434",
    model: env.REVIEW_QUEUE_LLM_MODEL ?? "qwen3.8-27b-cc",
    enabled: env.REVIEW_QUEUE_LLM !== "off",
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
        max_tokens: request.maxTokens,
        temperature: 0,
        stream,
        system: request.system,
        thinking: { type: "disabled" },
        messages: request.messages,
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
  delta?: { type?: string; text?: string };
  error?: { message?: string };
};

function eventText(rawEvent: string): string {
  const data = rawEvent
    .split("\n")
    .filter((line) => line.startsWith("data:"))
    .map((line) => line.slice(5).trim())
    .join("");
  if (!data) return "";
  const event = JSON.parse(data) as StreamEvent;
  if (event.type === "error") throw new Error(event.error?.message ?? "LLM stream failed");
  return event.type === "content_block_delta" && event.delta?.type === "text_delta"
    ? (event.delta.text ?? "")
    : "";
}

async function* textChunks(body: ReadableStream<Uint8Array>): AsyncGenerator<string> {
  const decoder = new TextDecoder();
  const reader = body.getReader();
  for (let read = await reader.read(); !read.done; read = await reader.read()) {
    yield decoder.decode(read.value, { stream: true });
  }
}

export async function* streamModel(
  client: LlmClient,
  request: ModelRequest,
  signal?: AbortSignal,
): AsyncGenerator<string> {
  const response = await postMessages(client, request, true, signal);
  if (!response.body) return;
  let pending = "";
  for await (const chunk of textChunks(response.body)) {
    const events = (pending + chunk).replaceAll("\r\n", "\n").split("\n\n");
    pending = events.pop() ?? "";
    for (const rawEvent of events) {
      const text = eventText(rawEvent);
      if (text) yield text;
    }
  }
  const last = eventText(pending);
  if (last) yield last;
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
