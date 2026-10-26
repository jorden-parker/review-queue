import { getPullRequest, listReviewRequests, type ReviewRequest } from "@/lib/github/gh";
import { TtlCache } from "@/lib/github/ttl-cache";
import { prKey } from "@/lib/pr-ref";
import { defaultDatabasePath, SessionStore } from "@/lib/session/store";
import type { ReviewDeps } from "./prepare";

const REVIEW_REQUESTS_TTL_MS = 60_000;
const PULL_REQUEST_TTL_MS = 30_000;

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

export function reviewDeps(): ReviewDeps {
  return {
    fetchPullRequest: (ref) =>
      githubCache().get(`pull-request:${prKey(ref)}`, PULL_REQUEST_TTL_MS, () =>
        getPullRequest(ref, sessionStore()),
      ),
    store: sessionStore(),
  };
}
