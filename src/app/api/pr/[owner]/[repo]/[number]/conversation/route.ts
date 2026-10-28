import { logServerError } from "@/lib/log";
import { GITHUB_FAILURE_MESSAGE, jsonError, withPullRequest } from "@/lib/review/route-context";
import { conversation } from "@/lib/review/services";

export const GET = withPullRequest(async (_request, ref) => {
  try {
    return Response.json(await conversation(ref));
  } catch (error) {
    logServerError("load conversation", error);
    return jsonError(GITHUB_FAILURE_MESSAGE, 502);
  }
});
