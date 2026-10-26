"use client";

import Link from "next/link";
import type { PullRequestRef } from "@/lib/types";
import { ReviewWorkspace } from "./review-workspace";
import { useReview } from "./use-review";

export function ReviewLoader({ pullRequest }: { pullRequest: PullRequestRef }) {
  const controls = useReview(pullRequest);
  const { load, session, orientation } = controls;
  if (load.status === "loading") {
    return (
      <main className="flex h-screen flex-col items-center justify-center gap-2 text-center">
        <p className="text-lg font-bold">Getting the PR ready…</p>
        <p className="max-w-md text-sm text-muted">
          Fetching, checking out the branch and indexing symbols. The first time for a repo can take
          a minute.
        </p>
      </main>
    );
  }
  if (load.status === "error") {
    return (
      <main className="mx-auto flex max-w-xl flex-col gap-3 px-4 py-16">
        <h1 className="text-xl font-bold">Couldn&apos;t open this PR</h1>
        <p className="rounded-lg bg-del p-3 font-mono text-sm text-del-ink">{load.message}</p>
        <Link href="/" className="underline">
          Back to inbox
        </Link>
      </main>
    );
  }
  if (!session) return null;
  return (
    <ReviewWorkspace
      pullRequest={pullRequest}
      review={load.review}
      session={session}
      orientation={orientation}
      controls={controls}
    />
  );
}
