import type { ZodType } from "zod";
import { refFromParams } from "@/lib/pr-ref";
import type { PullRequestRef } from "@/lib/types";
import { findPrepared, type PreparedReview } from "./prepare";

type PrRouteContext = { params: Promise<{ owner: string; repo: string; number: string }> };

export const GITHUB_FAILURE_MESSAGE = "GitHub request failed";
const BAD_REFERENCE_MESSAGE = "Bad pull request reference";
const BAD_BODY_MESSAGE = "Request body must be JSON";

type PullRequestHandler = (request: Request, ref: PullRequestRef) => Response | Promise<Response>;
type PreparedHandler = (request: Request, prepared: PreparedReview) => Response | Promise<Response>;

async function routeRef(context: PrRouteContext): Promise<PullRequestRef | null> {
  return refFromParams(await context.params);
}

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

export function withPullRequest(handler: PullRequestHandler) {
  return async (request: Request, context: PrRouteContext): Promise<Response> => {
    const ref = await routeRef(context);
    if (!ref) return jsonError(BAD_REFERENCE_MESSAGE, 400);
    return handler(request, ref);
  };
}

async function preparedFromRequest(
  request: Request,
  context: PrRouteContext,
): Promise<PreparedReview | Response> {
  const ref = await routeRef(context);
  if (!ref) return jsonError(BAD_REFERENCE_MESSAGE, 400);
  const sha = new URL(request.url).searchParams.get("sha") ?? "";
  const prepared = findPrepared(ref, sha);
  if (!prepared) return jsonError("Review is not loaded for that commit; reload the page", 409);
  return prepared;
}

export function withPreparedReview(handler: PreparedHandler) {
  return async (request: Request, context: PrRouteContext): Promise<Response> => {
    const prepared = await preparedFromRequest(request, context);
    if (prepared instanceof Response) return prepared;
    return handler(request, prepared);
  };
}
