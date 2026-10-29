import { explanationFor } from "@/lib/review/explanation-service";
import { withPreparedReview } from "@/lib/review/route-context";
import { jsonError } from "@/lib/http";
import { currentLlmConfig, sessionStore } from "@/lib/review/services";

export const GET = withPreparedReview(async (request, prepared) => {
  const stepId = new URL(request.url).searchParams.get("step");
  if (!stepId) return jsonError("Missing step", 400);
  return Response.json(
    await explanationFor(
      prepared.data,
      stepId,
      sessionStore(),
      await currentLlmConfig(),
      fetch,
      request.signal,
    ),
  );
});
