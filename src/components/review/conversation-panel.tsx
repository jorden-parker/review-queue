"use client";

import { relativeTime } from "@/components/inbox/in-progress-list";
import { EmptyState } from "@/components/common/empty-state";
import { Markdown } from "@/components/common/markdown-text";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { Conversation } from "@/lib/github/conversation";
import type { PostedReview } from "@/lib/github/gh";
import { VERDICT_LABELS } from "@/lib/review/verdict-labels";
import type { Session } from "@/lib/session/store";
import type { Thread } from "./conversation-threads";
import type { LineTarget } from "./locate";

const REVIEW_STATE_LABELS: Record<PostedReview["state"], string> = {
  APPROVED: "Approved",
  CHANGES_REQUESTED: "Changes requested",
  COMMENTED: "Commented",
  DISMISSED: "Dismissed",
  PENDING: "Pending",
};

type Receipt = Session["submissions"][number];

type ConversationPanelProps = {
  conversation: Conversation;
  error: string | null;
  threads: Thread[];
  receipts: Receipt[];
  onOpen: (target: LineTarget) => void;
};

export function ConversationPanel({
  conversation,
  error,
  threads,
  receipts,
  onOpen,
}: ConversationPanelProps) {
  return (
    <div className="flex flex-col gap-5 text-sm">
      {error && <p className="text-destructive">Could not load the conversation: {error}</p>}
      <ConversationEmpty conversation={conversation} threads={threads} receipts={receipts} />
      <ReviewsSection reviews={conversation.reviews} />
      <ThreadsSection threads={threads} onOpen={onOpen} />
      {conversation.truncated && (
        <p className="text-xs text-muted-foreground">Showing the first 100</p>
      )}
      <ReceiptsSection receipts={receipts} />
    </div>
  );
}

function ConversationEmpty({
  conversation,
  threads,
  receipts,
}: {
  conversation: Conversation;
  threads: Thread[];
  receipts: Receipt[];
}) {
  const nothing = conversation.reviews.length + threads.length + receipts.length === 0;
  if (!nothing) return null;
  return <EmptyState emoji="💬">Nothing from GitHub on this pull request yet.</EmptyState>;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <h3 className="text-sm font-bold">{title}</h3>
      {children}
    </section>
  );
}

function ReviewsSection({ reviews }: { reviews: PostedReview[] }) {
  if (reviews.length === 0) return null;
  return (
    <Section title="Reviews">
      {reviews.map((review) => (
        <ReviewRow key={review.id} review={review} />
      ))}
    </Section>
  );
}

function ThreadsSection({
  threads,
  onOpen,
}: {
  threads: Thread[];
  onOpen: (target: LineTarget) => void;
}) {
  if (threads.length === 0) return null;
  return (
    <Section title="Conversation">
      {threads.map((thread) => (
        <ThreadRow key={thread.root.id} thread={thread} onOpen={onOpen} />
      ))}
    </Section>
  );
}

function ReceiptsSection({ receipts }: { receipts: Receipt[] }) {
  if (receipts.length === 0) return null;
  return (
    <Section title="You posted">
      {receipts.map((receipt) => (
        <ReceiptRow key={receipt.reviewId} receipt={receipt} />
      ))}
    </Section>
  );
}

function ReviewRow({ review }: { review: PostedReview }) {
  return (
    <article className="flex flex-col gap-1.5 rounded-md border p-3">
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <span className="font-medium text-foreground">{review.author}</span>
        <Badge variant="outline" className="h-auto whitespace-normal wrap-anywhere">
          {REVIEW_STATE_LABELS[review.state]}
        </Badge>
        {review.submittedAt && <span>{relativeTime(review.submittedAt)}</span>}
        <a href={review.url} target="_blank" rel="noreferrer" className="underline">
          View
        </a>
      </div>
      {review.body && <Markdown text={review.body} className="wrap-anywhere" />}
    </article>
  );
}

function ThreadRow({ thread, onOpen }: { thread: Thread; onOpen: (target: LineTarget) => void }) {
  const { root, replies } = thread;
  const { path, line, side } = root;
  return (
    <article className="flex flex-col gap-1.5 rounded-md border p-3">
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <span className="font-mono">{path}</span>
        <span className="font-medium text-foreground">{root.author}</span>
        <span>{relativeTime(root.createdAt)}</span>
        {thread.outdated && <Badge variant="outline">Outdated</Badge>}
      </div>
      <Markdown text={root.body} className="wrap-anywhere" />
      <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
        <span>{replies.length > 0 && replyCount(replies.length)}</span>
        {line !== null && side === "RIGHT" && (
          <Button
            variant="outline"
            size="sm"
            aria-label={`Open ${path} line ${line}`}
            onClick={() => onOpen({ path, line })}
          >
            Open
          </Button>
        )}
      </div>
    </article>
  );
}

function replyCount(count: number): string {
  return count === 1 ? "1 reply" : `${count} replies`;
}

function ReceiptRow({ receipt }: { receipt: Receipt }) {
  return (
    <article className="flex flex-wrap items-center gap-2 rounded-md border p-3 text-xs text-muted-foreground">
      <span className="font-medium text-foreground">{VERDICT_LABELS[receipt.event]}</span>
      <span>{relativeTime(receipt.postedAt)}</span>
      <a href={receipt.url} target="_blank" rel="noreferrer" className="underline">
        Open
      </a>
    </article>
  );
}
