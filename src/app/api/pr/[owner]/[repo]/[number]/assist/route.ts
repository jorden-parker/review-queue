import { assistResponse } from "@/lib/review/assist-service";
import { preparedFromRequest, type PrRouteContext } from "@/lib/review/route-context";
import { storedExplanation } from "@/lib/review/explanation-service";
import { currentLlmConfig, sessionStore } from "@/lib/review/services";

export async function POST(request: Request, context: PrRouteContext) {
  const prepared = await preparedFromRequest(request, context);
  if (prepared instanceof Response) return prepared;
  const body = await request.json().catch(() => null);
  const config = await currentLlmConfig();
  const source = {
    ...prepared,
    explanationOf: (stepId: string) =>
      storedExplanation(prepared.data, stepId, sessionStore(), config),
  };
  return assistResponse(source, body, config, fetch, request.signal);
}
