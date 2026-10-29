import type { ZodType } from "zod";

export const NOT_LOADED_MESSAGE = "Review is not loaded for that commit; reload the page";
const BAD_BODY_MESSAGE = "Request body must be JSON";

export function jsonError(message: string, status: number): Response {
  return Response.json({ error: message }, { status });
}

export function readJson(request: Request): Promise<unknown> {
  return request.json().catch(() => null);
}

export async function parseJsonBody<Output>(
  request: Request,
  schema: ZodType<Output>,
): Promise<Output | Response> {
  const body = await readJson(request);
  if (body === null) return jsonError(BAD_BODY_MESSAGE, 400);
  const parsed = schema.safeParse(body);
  return parsed.success ? parsed.data : jsonError(parsed.error.message, 400);
}

export function searchParam(request: Request, name: string): string {
  return new URL(request.url).searchParams.get(name) ?? "";
}
