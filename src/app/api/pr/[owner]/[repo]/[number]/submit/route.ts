import { z } from "zod";
import { getPullRequest, submitReview } from "@/lib/github/gh";
import { logServerError } from "@/lib/log";
import { prKey } from "@/lib/pr-ref";
import { GITHUB_FAILURE_MESSAGE, withPullRequest } from "@/lib/review/route-context";
import { jsonError, parseJsonBody } from "@/lib/http";
import { sessionStore } from "@/lib/review/services";
import { buildSubmission, isPostable } from "@/lib/review/submission";

const STALE_HEAD_MESSAGE =
  "The author pushed new commits since you loaded this review. Reload and check the changes before posting.";

const SubmitSchema = z.object({
  event: z.enum(["APPROVE", "REQUEST_CHANGES", "COMMENT"]),
  summary: z.string(),
  noteIds: z.array(z.number().int()),
  headSha: z.string().min(1),
});

export const POST = withPullRequest(async (request, ref) => {
  const input = await parseJsonBody(request, SubmitSchema);
  if (input instanceof Response) return input;
  const store = sessionStore();
  const key = prKey(ref);
  const chosen = store.getSession(key).notes.filter((note) => input.noteIds.includes(note.id));
  const postable = chosen.filter(isPostable);
  const submission = buildSubmission(postable, input.event, input.summary, input.headSha);
  let posted: { id: number; url: string };
  try {
    const current = await getPullRequest(ref, sessionStore());
    if (current.headSha !== input.headSha) {
      return jsonError(STALE_HEAD_MESSAGE, 409);
    }
    posted = await submitReview(ref, submission);
  } catch (error) {
    logServerError("submit review", error);
    return jsonError(GITHUB_FAILURE_MESSAGE, 502);
  }
  store.recordSubmission(key, {
    reviewId: posted.id,
    url: posted.url,
    event: input.event,
    headSha: input.headSha,
    body: submission.body,
  });
  for (const note of postable) store.deleteNote(key, note.id);
  store.markFinished(key);
  return Response.json(store.getSession(key));
});
