import { logServerError } from "@/lib/log";
import { GITHUB_FAILURE_MESSAGE, withPullRequest } from "@/lib/review/route-context";
import { jsonError } from "@/lib/http";
import { conversationView } from "@/lib/review/services";

export const GET = withPullRequest(async (_request, ref) => {
  try {
    return Response.json(await conversationView(ref));
  } catch (error) {
    logServerError("load conversation", error);
    return jsonError(GITHUB_FAILURE_MESSAGE, 502);
  }
});
