import { refFromParams } from "@/lib/pr-ref";
import type { PullRequestRef } from "@/lib/types";
import { findPrepared, type PreparedReview } from "./prepare";

export type PrRouteContext = { params: Promise<{ owner: string; repo: string; number: string }> };

export async function routeRef(context: PrRouteContext): Promise<PullRequestRef | null> {
  return refFromParams(await context.params);
}

export function jsonError(message: string, status: number): Response {
  return Response.json({ error: message }, { status });
}

export async function preparedFromRequest(
  request: Request,
  context: PrRouteContext,
): Promise<PreparedReview | Response> {
  const ref = await routeRef(context);
  if (!ref) return jsonError("Bad pull request reference", 400);
  const sha = new URL(request.url).searchParams.get("sha") ?? "";
  const prepared = findPrepared(ref, sha);
  if (!prepared) return jsonError("Review is not loaded for that commit; reload the page", 409);
  return prepared;
}
