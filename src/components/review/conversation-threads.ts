import type { ReviewComment } from "@/lib/github/gh";

export type Thread = { root: ReviewComment; replies: ReviewComment[]; outdated: boolean };

function byCreatedAt(first: ReviewComment, second: ReviewComment): number {
  return first.createdAt.localeCompare(second.createdAt);
}

function threadOf(root: ReviewComment, comments: ReviewComment[]): Thread {
  const replies = comments.filter((comment) => comment.inReplyTo === root.id).sort(byCreatedAt);
  return { root, replies, outdated: root.line === null };
}

export function threadsFor(comments: ReviewComment[]): Thread[] {
  return comments
    .filter((comment) => comment.inReplyTo === null)
    .sort(byCreatedAt)
    .map((root) => threadOf(root, comments));
}

export function threadsAt(threads: Thread[], path: string, line: number): Thread[] {
  return threads.filter(
    ({ root }) => root.path === path && root.line === line && root.side === "RIGHT",
  );
}
