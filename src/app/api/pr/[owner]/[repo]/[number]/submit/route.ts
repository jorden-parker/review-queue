import { z } from "zod";
import { getPullRequest, submitReview } from "@/lib/github/gh";
import { logServerError } from "@/lib/log";
import { prKey } from "@/lib/pr-ref";
import { GITHUB_FAILURE_MESSAGE, withPullRequest } from "@/lib/review/route-context";
import { jsonError, parseJsonBody } from "@/lib/http";
import { findPrepared } from "@/lib/review/prepare";
import { notesOffTheDiff, offTheDiffMessage } from "@/lib/review/note-targets";
import { sessionStore } from "@/lib/review/services";
import { buildSubmission, isPostable } from "@/lib/review/submission";
import type { Note, PullRequestRef } from "@/lib/types";

const STALE_HEAD_MESSAGE =
  "The author pushed new commits since you loaded this review. Reload and check the changes before posting.";

const LINE_REFUSED_MESSAGE =
  "GitHub refused a line comment because that line is not in the diff. Deselect notes made against earlier commits and try again.";

const SubmitSchema = z.object({
  event: z.enum(["APPROVE", "REQUEST_CHANGES", "COMMENT"]),
  summary: z.string(),
  noteIds: z.array(z.number().int()),
  headSha: z.string().min(1),
});

async function offDiffNotes(ref: PullRequestRef, headSha: string, notes: Note[]): Promise<Note[]> {
  const pending = findPrepared(ref, headSha);
  if (!pending) return [];
  return notesOffTheDiff(notes, (await pending).data.files);
}

function githubStatusOf(error: unknown): number | null {
  const match = error instanceof Error ? /\(HTTP (\d{3})\)/.exec(error.message) : null;
  return match ? Number(match[1]) : null;
}

function githubFailure(error: unknown): Response {
  logServerError("submit review", error);
  if (githubStatusOf(error) === 422) return jsonError(LINE_REFUSED_MESSAGE, 422);
  return jsonError(GITHUB_FAILURE_MESSAGE, 502);
}

export const POST = withPullRequest(async (request, ref) => {
  const input = await parseJsonBody(request, SubmitSchema);
  if (input instanceof Response) return input;
  const store = sessionStore();
  const key = prKey(ref);
  const chosen = store.getSession(key).notes.filter((note) => input.noteIds.includes(note.id));
  const postable = chosen.filter(isPostable);
  const offDiff = await offDiffNotes(ref, input.headSha, postable);
  if (offDiff.length > 0) {
    return Response.json(
      { error: offTheDiffMessage(offDiff), noteIds: offDiff.map((note) => note.id) },
      { status: 400 },
    );
  }
  const submission = buildSubmission(postable, input.event, input.summary, input.headSha);
  let posted: { id: number; url: string };
  try {
    const current = await getPullRequest(ref, sessionStore());
    if (current.headSha !== input.headSha) {
      return jsonError(STALE_HEAD_MESSAGE, 409);
    }
    posted = await submitReview(ref, submission);
  } catch (error) {
    return githubFailure(error);
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
