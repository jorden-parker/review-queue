import { z } from "zod";
import { prKey } from "@/lib/pr-ref";
import { parseJsonBody, withPreparedReview } from "@/lib/review/route-context";
import { currentLlmConfig, sessionStore } from "@/lib/review/services";
import { summaryDraftFor } from "@/lib/review/summary-draft-service";

const SummaryDraftSchema = z.object({
  event: z.enum(["APPROVE", "REQUEST_CHANGES", "COMMENT"]),
  noteIds: z.array(z.number().int()),
});

export const POST = withPreparedReview(async (request, prepared) => {
  const input = await parseJsonBody(request, SummaryDraftSchema);
  if (input instanceof Response) return input;
  const notes = sessionStore()
    .getSession(prKey(prepared.data.pr.ref))
    .notes.filter((note) => input.noteIds.includes(note.id));
  return Response.json(
    await summaryDraftFor(
      prepared.data.pr.title,
      input.event,
      notes,
      await currentLlmConfig(),
      fetch,
      request.signal,
    ),
  );
});
