import { markReviewSeen } from "@/lib/review/prepare";
import { jsonError, withPullRequest } from "@/lib/review/route-context";
import { sessionStore } from "@/lib/review/services";

export const POST = withPullRequest(async (request, ref) => {
  const sha = new URL(request.url).searchParams.get("sha") ?? "";
  const seen = await markReviewSeen(ref, sha, sessionStore());
  if (!seen) return jsonError("Review is not loaded for that commit; reload the page", 409);
  return Response.json(seen);
});
