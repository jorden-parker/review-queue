import type { Runner } from "@/lib/exec";
import type { PullRequestRef } from "@/lib/types";
import type { EtagCache } from "./conditional-get";
import { githubRun } from "./github-guard";
import {
  CONVERSATION_MAX_PAGES,
  CONVERSATION_PAGE_SIZE,
  listReviewComments,
  listReviews,
  type PostedReview,
  type ReviewComment,
} from "./gh";

export type Conversation = {
  comments: ReviewComment[];
  reviews: PostedReview[];
  truncated: boolean;
};

export async function loadConversation(
  ref: PullRequestRef,
  cache: EtagCache,
  run: Runner = githubRun,
): Promise<Conversation> {
  const [comments, reviews] = await Promise.all([
    listReviewComments(ref, cache, run),
    listReviews(ref, cache, run),
  ]);
  const commentsFilled = comments.length === CONVERSATION_PAGE_SIZE * CONVERSATION_MAX_PAGES;
  const reviewsFilled = reviews.length === CONVERSATION_PAGE_SIZE;
  return { comments, reviews, truncated: commentsFilled || reviewsFilled };
}
