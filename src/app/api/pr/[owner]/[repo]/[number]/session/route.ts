import { prKey } from "@/lib/pr-ref";
import { jsonError, routeRef, type PrRouteContext } from "@/lib/review/route-context";
import { sessionStore } from "@/lib/review/services";
import { applySessionAction, SessionActionSchema } from "@/lib/review/session-actions";

export async function POST(request: Request, context: PrRouteContext) {
  const ref = await routeRef(context);
  if (!ref) return jsonError("Bad pull request reference", 400);
  const action = SessionActionSchema.safeParse(await request.json());
  if (!action.success) return jsonError(action.error.message, 400);
  return Response.json(applySessionAction(sessionStore(), prKey(ref), action.data));
}
