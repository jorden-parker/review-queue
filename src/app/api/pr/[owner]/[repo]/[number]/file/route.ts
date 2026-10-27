import { fileLines } from "@/lib/review/file-lines";
import { jsonError, preparedFromRequest, type PrRouteContext } from "@/lib/review/route-context";

function requestedPath(request: Request): string {
  return new URL(request.url).searchParams.get("path") ?? "";
}

export async function GET(request: Request, context: PrRouteContext) {
  const prepared = await preparedFromRequest(request, context);
  if (prepared instanceof Response) return prepared;
  const lines = await fileLines(prepared.index, requestedPath(request));
  return lines ? Response.json(lines) : jsonError("That file cannot be read from this review", 400);
}
