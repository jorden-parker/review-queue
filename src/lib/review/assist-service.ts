import { ASSIST_ERROR_MARKER } from "@/lib/assist-protocol";
import { assistStream } from "@/lib/llm/assist";
import type { LlmConfig } from "@/lib/llm/client";
import { AssistRequestSchema, assistInputFrom } from "./assist-request";
import type { ReviewData } from "./prepare";
import { jsonError } from "./route-context";

function textStream(chunks: AsyncGenerator<string>): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream({
    async pull(controller) {
      try {
        const next = await chunks.next();
        if (next.done) controller.close();
        else controller.enqueue(encoder.encode(next.value.replaceAll(ASSIST_ERROR_MARKER, "")));
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
  data: ReviewData,
  body: unknown,
  config: LlmConfig,
  fetchImpl: typeof fetch = fetch,
  signal?: AbortSignal,
): Response {
  if (!config.enabled) return jsonError("Local model is off", 404);
  const request = AssistRequestSchema.safeParse(body);
  if (!request.success) return jsonError(request.error.message, 400);
  const input = assistInputFrom(data, request.data);
  if (!input.ok) return jsonError(input.error, 400);
  const chunks = assistStream(input.input, request.data.history, config, fetchImpl, signal);
  return new Response(textStream(chunks), {
    headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" },
  });
}
