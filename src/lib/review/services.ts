import { getPullRequest } from "@/lib/github/gh";
import { defaultDatabasePath, SessionStore } from "@/lib/session/store";
import type { ReviewDeps } from "./prepare";

const globals = globalThis as { reviewQueueStore?: SessionStore };

export function sessionStore(): SessionStore {
  globals.reviewQueueStore ??= new SessionStore(
    process.env.REVIEW_QUEUE_DB ?? defaultDatabasePath(),
  );
  return globals.reviewQueueStore;
}

export function reviewDeps(): ReviewDeps {
  return { fetchPullRequest: (ref) => getPullRequest(ref), store: sessionStore() };
}
