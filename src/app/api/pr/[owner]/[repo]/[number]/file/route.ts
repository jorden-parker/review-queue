import { fileLines } from "@/lib/review/file-lines";
import { withPreparedReview } from "@/lib/review/route-context";
import { jsonError, searchParam } from "@/lib/http";

export const GET = withPreparedReview(async (request, prepared) => {
  const lines = await fileLines(prepared.index, searchParam(request, "path"));
  return lines ? Response.json(lines) : jsonError("That file cannot be read from this review", 400);
});
