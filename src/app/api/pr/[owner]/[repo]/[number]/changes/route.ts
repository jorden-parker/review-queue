import { prKey } from "@/lib/pr-ref";
import { interdiffFor } from "@/lib/review/interdiff";
import { jsonError, withPreparedReview } from "@/lib/review/route-context";
import { sessionStore } from "@/lib/review/services";

export const GET = withPreparedReview(async (_request, prepared) => {
  const baseline = sessionStore().getSession(prKey(prepared.data.pr.ref)).baselineHeadSha;
  if (!baseline) return jsonError("Nothing has changed since you last looked", 404);
  return Response.json(await interdiffFor(prepared, baseline));
});
