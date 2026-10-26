import { definitionsWithCode } from "@/lib/review/peek-code";
import { jsonError, preparedFromRequest, type PrRouteContext } from "@/lib/review/route-context";

export async function GET(request: Request, context: PrRouteContext) {
  const prepared = await preparedFromRequest(request, context);
  if (prepared instanceof Response) return prepared;
  const params = new URL(request.url).searchParams;
  const name = params.get("name");
  if (!name) return jsonError("Missing name", 400);
  return Response.json(await definitionsWithCode(prepared.index, name, params.get("from") ?? ""));
}
