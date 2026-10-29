import { logServerError } from "@/lib/log";
import { GITHUB_FAILURE_MESSAGE, withPullRequest } from "@/lib/review/route-context";
import { jsonError } from "@/lib/http";
import { linkedIssues } from "@/lib/review/services";

export const GET = withPullRequest(async (_request, ref) => {
  try {
    return Response.json({ issues: await linkedIssues(ref) });
  } catch (error) {
    logServerError("load linked issues", error);
    return jsonError(GITHUB_FAILURE_MESSAGE, 502);
  }
});
