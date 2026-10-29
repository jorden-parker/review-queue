import { ASSIST_ERROR_MARKER, ASSIST_LOOKUP_MARKER } from "@/lib/assist-protocol";
import { assistStream } from "@/lib/llm/assist";
import type { LlmConfig } from "@/lib/llm/client";
import type { LoopChunk } from "@/lib/llm/tool-loop";
import { codeTools } from "./code-tools";
import { AssistRequestSchema, type AssistSource, assistInputFrom } from "./assist-request";
import { jsonError } from "@/lib/http";

function encodedChunk(chunk: LoopChunk): string {
  if (chunk.kind === "lookup") {
    return `${ASSIST_LOOKUP_MARKER}${JSON.stringify(chunk.lookup)}${ASSIST_LOOKUP_MARKER}`;
  }
  return chunk.text.replaceAll(ASSIST_ERROR_MARKER, "").replaceAll(ASSIST_LOOKUP_MARKER, "");
}

function textStream(chunks: AsyncGenerator<LoopChunk>): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream({
    async pull(controller) {
      try {
        const next = await chunks.next();
        if (next.done) controller.close();
        else controller.enqueue(encoder.encode(encodedChunk(next.value)));
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        controller.enqueue(encoder.encode(`${ASSIST_ERROR_MARKER}${message}`));
        controller.close();
      }
    },
    async cancel() {
      await chunks.return(undefined);
    },
  });
}

export function assistResponse(
  source: AssistSource,
  body: unknown,
  config: LlmConfig,
  fetchImpl: typeof fetch = fetch,
  signal?: AbortSignal,
): Response {
  if (!config.enabled) return jsonError("Local model is off", 404);
  const request = AssistRequestSchema.safeParse(body);
  if (!request.success) return jsonError(request.error.message, 400);
  const input = assistInputFrom(source, request.data);
  if (!input.ok) return jsonError(input.error, 400);
  const chunks = assistStream(
    input.input,
    request.data.history,
    config,
    fetchImpl,
    signal,
    codeTools(source.index, input.input.path),
  );
  return new Response(textStream(chunks), {
    headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" },
  });
}
