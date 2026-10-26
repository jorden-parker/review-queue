import { jsonError, preparedFromRequest, type PrRouteContext } from "@/lib/review/route-context";

const SNIPPET_LINES = 40;

export async function GET(request: Request, context: PrRouteContext) {
  const prepared = await preparedFromRequest(request, context);
  if (prepared instanceof Response) return prepared;
  const params = new URL(request.url).searchParams;
  const name = params.get("name");
  if (!name) return jsonError("Missing name", 400);
  const definitions = prepared.index.definitionsOf(name, params.get("from") ?? "");
  return Response.json(
    definitions.map((definition) => ({
      ...definition,
      lines: prepared.index.readLines(
        definition.path,
        definition.line,
        Math.min(definition.endLine, definition.line + SNIPPET_LINES - 1),
      ),
    })),
  );
}
