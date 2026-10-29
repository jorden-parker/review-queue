import { withPreparedReview } from "@/lib/review/route-context";
import { jsonError } from "@/lib/http";

const MAX_QUERY_LENGTH = 200;

export const GET = withPreparedReview(async (request, prepared) => {
  const query = new URL(request.url).searchParams.get("q") ?? "";
  if (query.length > MAX_QUERY_LENGTH) {
    return jsonError(`Search is limited to ${MAX_QUERY_LENGTH} characters`, 400);
  }
  return Response.json({ results: await prepared.index.search(query) });
});
