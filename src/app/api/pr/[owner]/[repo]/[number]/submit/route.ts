import { z } from "zod";
import { submitReview } from "@/lib/github/gh";
import { prKey } from "@/lib/pr-ref";
import { jsonError, routeRef, type PrRouteContext } from "@/lib/review/route-context";
import { sessionStore } from "@/lib/review/services";
import { buildSubmission } from "@/lib/review/submission";

const SubmitSchema = z.object({
  event: z.enum(["APPROVE", "REQUEST_CHANGES", "COMMENT"]),
  summary: z.string(),
  noteIds: z.array(z.number().int()),
  headSha: z.string().min(1),
});

export async function POST(request: Request, context: PrRouteContext) {
  const ref = await routeRef(context);
  if (!ref) return jsonError("Bad pull request reference", 400);
  const input = SubmitSchema.safeParse(await request.json());
  if (!input.success) return jsonError(input.error.message, 400);
  const store = sessionStore();
  const key = prKey(ref);
  const chosen = store.getSession(key).notes.filter((note) => input.data.noteIds.includes(note.id));
  try {
    await submitReview(
      ref,
      buildSubmission(chosen, input.data.event, input.data.summary, input.data.headSha),
    );
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : String(error), 502);
  }
  for (const note of chosen) store.deleteNote(key, note.id);
  return Response.json(store.getSession(key));
}
