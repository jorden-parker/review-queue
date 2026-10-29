import { logServerError } from "@/lib/log";
import { GITHUB_FAILURE_MESSAGE, withPullRequest } from "@/lib/review/route-context";
import { jsonError } from "@/lib/http";
import { reviewDeps } from "@/lib/review/services";

export const GET = withPullRequest(async (_request, ref) => {
  try {
    const pr = await reviewDeps().fetchPullRequest(ref);
    return Response.json({ headSha: pr.headSha });
  } catch (error) {
    logServerError("read head", error);
    return jsonError(GITHUB_FAILURE_MESSAGE, 502);
  }
});
