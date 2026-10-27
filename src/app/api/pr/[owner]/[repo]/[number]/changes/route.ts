import { prKey } from "@/lib/pr-ref";
import { interdiffFor } from "@/lib/review/interdiff";
import { jsonError, preparedFromRequest, type PrRouteContext } from "@/lib/review/route-context";
import { sessionStore } from "@/lib/review/services";

export async function GET(request: Request, context: PrRouteContext) {
  const prepared = await preparedFromRequest(request, context);
  if (prepared instanceof Response) return prepared;
  const baseline = sessionStore().getSession(prKey(prepared.data.pr.ref)).baselineHeadSha;
  if (!baseline) return jsonError("Nothing has changed since you last looked", 404);
  return Response.json(await interdiffFor(prepared, baseline));
}
