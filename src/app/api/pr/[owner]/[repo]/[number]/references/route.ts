import { jsonError, preparedFromRequest, type PrRouteContext } from "@/lib/review/route-context";

export async function GET(request: Request, context: PrRouteContext) {
  const prepared = await preparedFromRequest(request, context);
  if (prepared instanceof Response) return prepared;
  const name = new URL(request.url).searchParams.get("name");
  if (!name) return jsonError("Missing name", 400);
  return Response.json(await prepared.index.referencesTo(name));
}
