import { llmConfigFromEnv } from "@/lib/llm/client";
import { assistResponse } from "@/lib/review/assist-service";
import { preparedFromRequest, type PrRouteContext } from "@/lib/review/route-context";

export async function POST(request: Request, context: PrRouteContext) {
  const prepared = await preparedFromRequest(request, context);
  if (prepared instanceof Response) return prepared;
  const body = await request.json().catch(() => null);
  return assistResponse(prepared.data, body, llmConfigFromEnv(), fetch, request.signal);
}
