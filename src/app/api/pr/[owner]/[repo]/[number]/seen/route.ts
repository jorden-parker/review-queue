import { markReviewSeen } from "@/lib/review/prepare";
import { withPullRequest } from "@/lib/review/route-context";
import { jsonError, NOT_LOADED_MESSAGE, searchParam } from "@/lib/http";
import { sessionStore } from "@/lib/review/services";

export const POST = withPullRequest(async (request, ref) => {
  const seen = await markReviewSeen(ref, searchParam(request, "sha"), sessionStore());
  if (!seen) return jsonError(NOT_LOADED_MESSAGE, 409);
  return Response.json(seen);
});
