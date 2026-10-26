import { explanationFor } from "@/lib/review/explanation-service";
import { jsonError, preparedFromRequest, type PrRouteContext } from "@/lib/review/route-context";
import { currentLlmConfig, sessionStore } from "@/lib/review/services";

export async function GET(request: Request, context: PrRouteContext) {
  const prepared = await preparedFromRequest(request, context);
  if (prepared instanceof Response) return prepared;
  const stepId = new URL(request.url).searchParams.get("step");
  if (!stepId) return jsonError("Missing step", 400);
  return Response.json(
    await explanationFor(prepared.data, stepId, sessionStore(), await currentLlmConfig()),
  );
}
