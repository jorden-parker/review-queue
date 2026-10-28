export function modelReply(text: string): Response {
  const event = { type: "content_block_delta", index: 0, delta: { type: "text_delta", text } };
  return new Response(`event: content_block_delta\ndata: ${JSON.stringify(event)}\n\n`, {
    headers: { "content-type": "text/event-stream" },
  });
}
