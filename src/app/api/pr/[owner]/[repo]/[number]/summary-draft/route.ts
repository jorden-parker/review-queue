import { z } from "zod";
import { prKey } from "@/lib/pr-ref";
import { jsonError, preparedFromRequest, type PrRouteContext } from "@/lib/review/route-context";
import { currentLlmConfig, sessionStore } from "@/lib/review/services";
import { summaryDraftFor } from "@/lib/review/summary-draft-service";

const SummaryDraftSchema = z.object({
  event: z.enum(["APPROVE", "REQUEST_CHANGES", "COMMENT"]),
  noteIds: z.array(z.number().int()),
});

export async function POST(request: Request, context: PrRouteContext) {
  const prepared = await preparedFromRequest(request, context);
  if (prepared instanceof Response) return prepared;
  const input = SummaryDraftSchema.safeParse(await request.json());
  if (!input.success) return jsonError(input.error.message, 400);
  const notes = sessionStore()
    .getSession(prKey(prepared.data.pr.ref))
    .notes.filter((note) => input.data.noteIds.includes(note.id));
  return Response.json(
    await summaryDraftFor(
      prepared.data.pr.title,
      input.data.event,
      notes,
      await currentLlmConfig(),
    ),
  );
}
