import { assistResponse } from "@/lib/review/assist-service";
import { storedExplanation } from "@/lib/review/explanation-service";
import { storedOrientation } from "@/lib/review/orientation-service";
import { withPreparedReview } from "@/lib/review/route-context";
import { readJson } from "@/lib/http";
import { currentLlmConfig, sessionStore } from "@/lib/review/services";

export const POST = withPreparedReview(async (request, prepared) => {
  const body = await readJson(request);
  const config = await currentLlmConfig();
  const source = {
    ...prepared,
    explanationOf: (stepId: string) =>
      storedExplanation(prepared.data, stepId, sessionStore(), config),
    suggestedHotspots: () =>
      storedOrientation(prepared.data, sessionStore(), config)?.extraHotspots ?? [],
  };
  return assistResponse(source, body, config, fetch, request.signal);
});
