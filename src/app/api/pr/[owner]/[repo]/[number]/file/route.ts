import { fileLines } from "@/lib/review/file-lines";
import { jsonError, withPreparedReview } from "@/lib/review/route-context";

function requestedPath(request: Request): string {
  return new URL(request.url).searchParams.get("path") ?? "";
}

export const GET = withPreparedReview(async (request, prepared) => {
  const lines = await fileLines(prepared.index, requestedPath(request));
  return lines ? Response.json(lines) : jsonError("That file cannot be read from this review", 400);
});
