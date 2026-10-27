"use client";

import { PageHeader, PageShell } from "@/components/common/page-shell";
import type { PullRequestRef } from "@/lib/types";
import { ReviewWorkspace } from "./review-workspace";
import { useReview } from "./use-review";

export function ReviewLoader({ pullRequest }: { pullRequest: PullRequestRef }) {
  const controls = useReview(pullRequest);
  const { load, session, orientation } = controls;
  if (load.status === "loading") {
    return (
      <main className="flex h-screen flex-col items-center justify-center gap-3 px-4 text-center sm:px-6">
        <span aria-hidden className="animate-float text-4xl">
          🦦
        </span>
        <p className="text-lg font-bold">Getting the PR ready…</p>
        <p className="max-w-md text-sm text-muted-foreground">
          Fetching, checking out the branch and indexing symbols. The first time for a repo can take
          a minute.
        </p>
      </main>
    );
  }
  if (load.status === "error") {
    return (
      <PageShell>
        <PageHeader title="Couldn't open this PR" backHref="/" backLabel="Review queue" />
        <p className="rounded-lg bg-del px-4 py-3 font-mono text-sm text-del-foreground">
          {load.message}
        </p>
      </PageShell>
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
