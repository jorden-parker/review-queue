import { preparedFromRequest, type PrRouteContext } from "@/lib/review/route-context";

export async function GET(request: Request, context: PrRouteContext) {
  const prepared = await preparedFromRequest(request, context);
  if (prepared instanceof Response) return prepared;
  return Response.json({ paths: await prepared.index.listFiles() });
}
