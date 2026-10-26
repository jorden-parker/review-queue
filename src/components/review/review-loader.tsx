"use client";

import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import type { PullRequestRef } from "@/lib/types";
import { ReviewWorkspace } from "./review-workspace";
import { useReview } from "./use-review";

export function ReviewLoader({ pullRequest }: { pullRequest: PullRequestRef }) {
  const controls = useReview(pullRequest);
  const { load, session, orientation } = controls;
  if (load.status === "loading") {
    return (
      <main className="flex h-screen flex-col items-center justify-center gap-3 text-center">
        <span aria-hidden className="animate-float text-4xl">
          🦦
        </span>
        <p className="text-lg font-semibold tracking-tight">Getting the PR ready…</p>
        <p className="max-w-md text-sm text-muted-foreground">
          Fetching, checking out the branch and indexing symbols. The first time for a repo can take
          a minute.
        </p>
      </main>
    );
  }
  if (load.status === "error") {
    return (
      <main className="mx-auto flex max-w-xl flex-col gap-3 px-4 py-16">
        <h1 className="text-xl font-semibold tracking-tight">🙈 Couldn&apos;t open this PR</h1>
        <p className="rounded-lg bg-del p-3 font-mono text-sm text-del-foreground">
          {load.message}
        </p>
        <Button variant="outline" className="w-fit" asChild>
          <Link href="/">
            <ArrowLeft /> Back to inbox
          </Link>
        </Button>
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
