import { orientationFor } from "@/lib/review/orientation-service";
import { preparedFromRequest, type PrRouteContext } from "@/lib/review/route-context";
import { currentLlmConfig, sessionStore } from "@/lib/review/services";

export async function GET(request: Request, context: PrRouteContext) {
  const prepared = await preparedFromRequest(request, context);
  if (prepared instanceof Response) return prepared;
  return Response.json(
    await orientationFor(prepared.data, sessionStore(), await currentLlmConfig()),
  );
}
