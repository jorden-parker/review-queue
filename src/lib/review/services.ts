import {
  type Conversation,
  type ConversationView,
  loadConversation,
} from "@/lib/github/conversation";
import {
  getPullRequest,
  listReviewRequests,
  type ReviewRequest,
  viewerLogin,
} from "@/lib/github/gh";
import { TtlCache } from "@/lib/github/ttl-cache";
import type { LlmConfig } from "@/lib/llm/client";
import { llmConfig } from "@/lib/llm/model-choice";
import { prKey } from "@/lib/pr-ref";
import type { PullRequestRef } from "@/lib/types";
import { defaultDatabasePath, SessionStore } from "@/lib/session/store";
import { savedLlmSettings } from "@/lib/settings/llm-settings";
import type { ReviewDeps } from "./prepare";

const REVIEW_REQUESTS_TTL_MS = 60_000;
const PULL_REQUEST_TTL_MS = 30_000;
const VIEWER_TTL_MS = 60 * 60_000;

const globals = globalThis as {
  reviewQueueStore?: SessionStore;
  reviewQueueGitHubCache?: TtlCache;
};

export function sessionStore(): SessionStore {
  globals.reviewQueueStore ??= new SessionStore(
    process.env.REVIEW_QUEUE_DB ?? defaultDatabasePath(),
  );
  return globals.reviewQueueStore;
}

function githubCache(): TtlCache {
  globals.reviewQueueGitHubCache ??= new TtlCache();
  return globals.reviewQueueGitHubCache;
}

export function reviewRequests(): Promise<ReviewRequest[]> {
  return githubCache().get("review-requests", REVIEW_REQUESTS_TTL_MS, () => listReviewRequests());
}

function conversationKey(ref: PullRequestRef): string {
  return `conversation:${prKey(ref)}`;
}

export function conversation(ref: PullRequestRef): Promise<Conversation> {
  return githubCache().get(conversationKey(ref), PULL_REQUEST_TTL_MS, () =>
    loadConversation(ref, sessionStore()),
  );
}

function viewer(): Promise<string | null> {
  return githubCache()
    .get("viewer", VIEWER_TTL_MS, viewerLogin)
    .catch(() => null);
}

export async function conversationView(ref: PullRequestRef): Promise<ConversationView> {
  const [loaded, signedInAs] = await Promise.all([conversation(ref), viewer()]);
  return { ...loaded, viewer: signedInAs };
}

export function forgetConversation(ref: PullRequestRef): void {
  githubCache().forget(conversationKey(ref));
}

export function reviewDeps(): ReviewDeps {
  return {
    fetchPullRequest: (ref) =>
      githubCache().get(`pull-request:${prKey(ref)}`, PULL_REQUEST_TTL_MS, () =>
        getPullRequest(ref, sessionStore()),
      ),
    store: sessionStore(),
  };
}

export function currentLlmConfig(): Promise<LlmConfig> {
  return llmConfig(process.env, fetch, savedLlmSettings(sessionStore()));
}
