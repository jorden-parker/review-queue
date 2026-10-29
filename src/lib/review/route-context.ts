import { jsonError, NOT_LOADED_MESSAGE, searchParam } from "@/lib/http";
import { refFromParams } from "@/lib/pr-ref";
import type { PullRequestRef } from "@/lib/types";
import { findPrepared, type PreparedReview } from "./prepare";

type PrRouteContext = { params: Promise<{ owner: string; repo: string; number: string }> };

export const GITHUB_FAILURE_MESSAGE = "GitHub request failed";
const BAD_REFERENCE_MESSAGE = "Bad pull request reference";

type PullRequestHandler = (request: Request, ref: PullRequestRef) => Response | Promise<Response>;
type PreparedHandler = (request: Request, prepared: PreparedReview) => Response | Promise<Response>;

async function routeRef(context: PrRouteContext): Promise<PullRequestRef | null> {
  return refFromParams(await context.params);
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
  const prepared = findPrepared(ref, searchParam(request, "sha"));
  if (!prepared) return jsonError(NOT_LOADED_MESSAGE, 409);
  return prepared;
}

export function withPreparedReview(handler: PreparedHandler) {
  return async (request: Request, context: PrRouteContext): Promise<Response> => {
    const prepared = await preparedFromRequest(request, context);
    if (prepared instanceof Response) return prepared;
    return handler(request, prepared);
  };
}
