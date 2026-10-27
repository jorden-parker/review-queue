import { jsonError, routeRef, type PrRouteContext } from "@/lib/review/route-context";
import { conversation } from "@/lib/review/services";

export async function GET(_request: Request, context: PrRouteContext) {
  const ref = await routeRef(context);
  if (!ref) return jsonError("Bad pull request reference", 400);
  try {
    return Response.json(await conversation(ref));
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : String(error), 502);
  }
}
