import { z } from "zod";
import { postReplyToReviewComment } from "@/lib/github/gh";
import { logServerError } from "@/lib/log";
import { prKey } from "@/lib/pr-ref";
import { jsonError, readJson, withPullRequest } from "@/lib/review/route-context";
import { forgetConversation, sessionStore } from "@/lib/review/services";
import { REPLY_MAX_LENGTH } from "@/lib/types";

const REPLY_INVALID_MESSAGE = `A reply needs a comment id and 1 to ${REPLY_MAX_LENGTH} characters.`;
const REPLY_FAILED_MESSAGE =
  "GitHub did not accept the reply. It may still have been saved, so check the conversation before you try again.";

const ReplySchema = z.object({
  commentId: z.number().int().positive(),
  body: z.string().trim().min(1).max(REPLY_MAX_LENGTH),
});

export const POST = withPullRequest(async (request, ref) => {
  const input = ReplySchema.safeParse(await readJson(request));
  if (!input.success) return jsonError(REPLY_INVALID_MESSAGE, 400);
  let posted: { id: number; url: string };
  try {
    posted = await postReplyToReviewComment(ref, input.data.commentId, input.data.body);
  } catch (error) {
    logServerError("reply to review comment", error);
    return jsonError(REPLY_FAILED_MESSAGE, 502);
  }
  const store = sessionStore();
  const key = prKey(ref);
  store.recordReply(key, {
    replyId: posted.id,
    parentCommentId: input.data.commentId,
    url: posted.url,
    body: input.data.body,
  });
  forgetConversation(ref);
  return Response.json(store.getSession(key));
});
