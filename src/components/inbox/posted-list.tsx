import Link from "next/link";
import { EmptyState } from "@/components/common/empty-state";
import { InlineMarkdown } from "@/components/common/markdown-text";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { parsePullRequestRef, prPath } from "@/lib/pr-ref";
import { VERDICT_LABELS } from "@/lib/review/verdict-labels";
import type { RecentSubmission } from "@/lib/session/store";
import { relativeTime } from "./in-progress-list";

export const POSTED_REVIEW_LIMIT = 10;

function PostedRow({ review }: { review: RecentSubmission }) {
  const ref = parsePullRequestRef(review.key);
  return (
    <li className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-4">
      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="font-bold">
          <InlineMarkdown text={review.title ?? review.key} />
        </span>
        <span className="flex flex-wrap gap-x-3 text-sm text-muted-foreground">
          <span>{review.key}</span>
          <span>posted {relativeTime(review.postedAt)}</span>
        </span>
      </span>
      <Badge variant="outline">{VERDICT_LABELS[review.event]}</Badge>
      <span className="flex items-center gap-1">
        {ref && (
          <Button variant="ghost" size="sm" asChild>
            <Link href={prPath(ref)}>Open</Link>
          </Button>
        )}
        <Button variant="ghost" size="sm" asChild>
          <a href={review.url} target="_blank" rel="noreferrer">
            On GitHub
          </a>
        </Button>
      </span>
    </li>
  );
}

export function PostedList({ reviews }: { reviews: RecentSubmission[] }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-lg font-bold">Posted</h2>
      {reviews.length === 0 ? (
        <div className="rounded-xl bg-card ring-1 ring-border">
          <EmptyState emoji="📭">Nothing posted yet</EmptyState>
        </div>
      ) : (
        <>
          <ul className="divide-y overflow-hidden rounded-xl bg-card ring-1 ring-border">
            {reviews.map((review) => (
              <PostedRow key={review.reviewId} review={review} />
            ))}
          </ul>
          {reviews.length === POSTED_REVIEW_LIMIT && (
            <p className="text-sm text-muted-foreground">
              Showing the latest {POSTED_REVIEW_LIMIT}
            </p>
          )}
        </>
      )}
    </section>
  );
}
