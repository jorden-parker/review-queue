import { jsonError, preparedFromRequest, type PrRouteContext } from "@/lib/review/route-context";

const MAX_QUERY_LENGTH = 200;

export async function GET(request: Request, context: PrRouteContext) {
  const prepared = await preparedFromRequest(request, context);
  if (prepared instanceof Response) return prepared;
  const query = new URL(request.url).searchParams.get("q") ?? "";
  if (query.length > MAX_QUERY_LENGTH) {
    return jsonError(`Search is limited to ${MAX_QUERY_LENGTH} characters`, 400);
  }
  return Response.json({ results: await prepared.index.search(query) });
}
