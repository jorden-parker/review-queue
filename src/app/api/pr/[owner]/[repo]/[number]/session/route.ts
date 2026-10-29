import { prKey } from "@/lib/pr-ref";
import { withPullRequest } from "@/lib/review/route-context";
import { parseJsonBody } from "@/lib/http";
import { sessionStore } from "@/lib/review/services";
import { applySessionAction, SessionActionSchema } from "@/lib/review/session-actions";

export const POST = withPullRequest(async (request, ref) => {
  const action = await parseJsonBody(request, SessionActionSchema);
  if (action instanceof Response) return action;
  return Response.json(applySessionAction(sessionStore(), prKey(ref), action));
});
