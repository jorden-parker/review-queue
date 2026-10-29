import { orientationFor } from "@/lib/review/orientation-service";
import { withPreparedReview } from "@/lib/review/route-context";
import { currentLlmConfig, sessionStore } from "@/lib/review/services";

export const GET = withPreparedReview(async (request, prepared) =>
  Response.json(
    await orientationFor(
      prepared.data,
      sessionStore(),
      await currentLlmConfig(),
      fetch,
      request.signal,
    ),
  ),
);
