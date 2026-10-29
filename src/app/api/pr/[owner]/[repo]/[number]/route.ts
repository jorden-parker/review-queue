import { logServerError } from "@/lib/log";
import { loadReview } from "@/lib/review/prepare";
import { GITHUB_FAILURE_MESSAGE, withPullRequest } from "@/lib/review/route-context";
import { jsonError } from "@/lib/http";
import { reviewDeps } from "@/lib/review/services";

export const GET = withPullRequest(async (_request, ref) => {
  try {
    return Response.json(await loadReview(ref, reviewDeps()));
  } catch (error) {
    logServerError("load review", error);
    return jsonError(GITHUB_FAILURE_MESSAGE, 502);
  }
});
