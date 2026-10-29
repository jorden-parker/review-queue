import type { ReviewComment } from "@/lib/github/gh";
import type { Thread } from "./conversation-threads";

export type YourThreadState = "new-reply" | "waiting";
export type YourThread = { thread: Thread; state: YourThreadState };

const STATE_ORDER: Record<YourThreadState, number> = { "new-reply": 0, waiting: 1 };

function sameLogin(author: string, viewer: string): boolean {
  return author.toLowerCase() === viewer.toLowerCase();
}

function commentsOf(thread: Thread): ReviewComment[] {
  return [thread.root, ...thread.replies];
}

export function latestComment(thread: Thread): ReviewComment {
  return commentsOf(thread).reduce((latest, comment) =>
    comment.createdAt > latest.createdAt ? comment : latest,
  );
}

function isYours(thread: Thread, viewer: string): boolean {
  return commentsOf(thread).some((comment) => sameLogin(comment.author, viewer));
}

function stateOf(thread: Thread, viewer: string): YourThreadState {
  return sameLogin(latestComment(thread).author, viewer) ? "waiting" : "new-reply";
}

function compareYourThreads(first: YourThread, second: YourThread): number {
  return (
    STATE_ORDER[first.state] - STATE_ORDER[second.state] ||
    Number(second.thread.outdated) - Number(first.thread.outdated) ||
    first.thread.root.createdAt.localeCompare(second.thread.root.createdAt)
  );
}

export function yourThreads(threads: readonly Thread[], viewer: string | null): YourThread[] {
  if (viewer === null) return [];
  return threads
    .filter((thread) => isYours(thread, viewer))
    .map((thread) => ({ thread, state: stateOf(thread, viewer) }))
    .sort(compareYourThreads);
}

export function newReplyCount(threads: readonly Thread[], viewer: string | null): number | null {
  const count = yourThreads(threads, viewer).filter(({ state }) => state === "new-reply").length;
  return count === 0 ? null : count;
}
