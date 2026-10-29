"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { relativeTime } from "@/components/inbox/in-progress-list";
import { EmptyState } from "@/components/common/empty-state";
import { Markdown } from "@/components/common/markdown-text";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { ConversationView } from "@/lib/github/conversation";
import type { PostedReview, ReviewComment } from "@/lib/github/gh";
import { VERDICT_LABELS } from "@/lib/review/verdict-labels";
import type { Session } from "@/lib/session/store";
import type { Thread } from "./conversation-threads";
import type { LineTarget } from "./locate";
import { ThreadReplyComposer } from "./thread-reply";
import { latestComment, type YourThread, type YourThreadState, yourThreads } from "./your-threads";

const REVIEW_STATE_LABELS: Record<PostedReview["state"], string> = {
  APPROVED: "Approved",
  CHANGES_REQUESTED: "Changes requested",
  COMMENTED: "Commented",
  DISMISSED: "Dismissed",
  PENDING: "Pending",
};

type Receipt = Session["submissions"][number];
type ReplyReceipt = Session["replyReceipts"][number];

type ReplyControls = {
  activeRootId: number | null;
  arrivedId: number | null;
  clearArrived: () => void;
  start: (rootId: number) => void;
  cancel: () => void;
  send: (rootId: number, body: string) => Promise<void>;
};

type ConversationPanelProps = {
  conversation: ConversationView;
  error: string | null;
  threads: Thread[];
  receipts: Receipt[];
  replyReceipts: ReplyReceipt[];
  onOpen: (target: LineTarget) => void;
  onReply: (commentId: number, body: string) => Promise<number>;
};

export function ConversationPanel({
  conversation,
  error,
  threads,
  receipts,
  replyReceipts,
  onOpen,
  onReply,
}: ConversationPanelProps) {
  const [activeRootId, setActiveRootId] = useState<number | null>(null);
  const [arrivedReplyId, setArrivedReplyId] = useState<number | null>(null);
  const mine = useMemo(
    () => yourThreads(threads, conversation.viewer),
    [threads, conversation.viewer],
  );

  const reply: ReplyControls = {
    activeRootId,
    arrivedId: arrivedReplyId,
    clearArrived: () => setArrivedReplyId(null),
    start: setActiveRootId,
    cancel: () => setActiveRootId(null),
    send: async (rootId, body) => {
      const replyId = await onReply(rootId, body);
      setActiveRootId(null);
      setArrivedReplyId(replyId);
    },
  };

  return (
    <div className="flex flex-col gap-5 text-sm">
      {error && <p className="text-destructive">Could not load the conversation: {error}</p>}
      <ConversationEmpty
        conversation={conversation}
        threads={threads}
        receipts={receipts}
        replyReceipts={replyReceipts}
      />
      <YourThreadsSection mine={mine} onOpen={onOpen} />
      <ReviewsSection reviews={conversation.reviews} />
      <ThreadsSection threads={threads} onOpen={onOpen} reply={reply} />
      {conversation.truncated && (
        <p className="text-xs text-muted-foreground">
          Showing part of the conversation. The rest is on GitHub.
        </p>
      )}
      <ReceiptsSection receipts={receipts} replyReceipts={replyReceipts} />
    </div>
  );
}

const THREAD_STATE_BADGES: Record<
  YourThreadState,
  { label: string; variant: "default" | "outline" }
> = {
  "new-reply": { label: "New reply", variant: "default" },
  waiting: { label: "Waiting on others", variant: "outline" },
};

function YourThreadsSection({
  mine,
  onOpen,
}: {
  mine: YourThread[];
  onOpen: (target: LineTarget) => void;
}) {
  if (mine.length === 0) return null;
  return (
    <Section title="Your threads">
      {mine.map(({ thread, state }) => (
        <YourThreadRow key={thread.root.id} thread={thread} state={state} onOpen={onOpen} />
      ))}
    </Section>
  );
}

function YourThreadRow({
  thread,
  state,
  onOpen,
}: {
  thread: Thread;
  state: YourThreadState;
  onOpen: (target: LineTarget) => void;
}) {
  const { path, line, side } = thread.root;
  const target = line !== null && side === "RIGHT" ? { path, line } : null;
  const latest = latestComment(thread);
  const { label, variant } = THREAD_STATE_BADGES[state];
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-md border p-2 text-xs text-muted-foreground">
      <Button
        variant="outline"
        size="sm"
        disabled={target === null}
        onClick={() => target && onOpen(target)}
      >
        {line === null ? "outdated" : `${path}:${line}`}
      </Button>
      <Badge variant={variant}>{label}</Badge>
      {thread.outdated && <Badge variant="outline">Outdated</Badge>}
      <span>{`${latest.author} · ${relativeTime(latest.createdAt)}`}</span>
    </div>
  );
}

function ConversationEmpty({
  conversation,
  threads,
  receipts,
  replyReceipts,
}: {
  conversation: ConversationView;
  threads: Thread[];
  receipts: Receipt[];
  replyReceipts: ReplyReceipt[];
}) {
  const nothing =
    conversation.reviews.length + threads.length + receipts.length + replyReceipts.length === 0;
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
  reply,
}: {
  threads: Thread[];
  onOpen: (target: LineTarget) => void;
  reply: ReplyControls;
}) {
  if (threads.length === 0) return null;
  return (
    <Section title="Conversation">
      {threads.map((thread) => (
        <ThreadRow key={thread.root.id} thread={thread} onOpen={onOpen} reply={reply} />
      ))}
    </Section>
  );
}

function ReceiptsSection({
  receipts,
  replyReceipts,
}: {
  receipts: Receipt[];
  replyReceipts: ReplyReceipt[];
}) {
  if (receipts.length + replyReceipts.length === 0) return null;
  return (
    <Section title="You posted">
      {receipts.map((receipt) => (
        <ReceiptRow
          key={`review-${receipt.reviewId}`}
          label={VERDICT_LABELS[receipt.event]}
          postedAt={receipt.postedAt}
          url={receipt.url}
        />
      ))}
      {replyReceipts.map((receipt) => (
        <ReceiptRow
          key={`reply-${receipt.replyId}`}
          label="Reply"
          postedAt={receipt.postedAt}
          url={receipt.url}
        />
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

function ThreadRow({
  thread,
  onOpen,
  reply,
}: {
  thread: Thread;
  onOpen: (target: LineTarget) => void;
  reply: ReplyControls;
}) {
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
      {replies.map((answer) => (
        <ReplyItem
          key={answer.id}
          reply={answer}
          arrived={reply.arrivedId === answer.id}
          onArrived={reply.clearArrived}
        />
      ))}
      <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
        <span>{replies.length > 0 && replyCount(replies.length)}</span>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            aria-label={replyLabel(path, line)}
            onClick={() => reply.start(root.id)}
          >
            Reply
          </Button>
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
      </div>
      {reply.activeRootId === root.id && (
        <ThreadReplyComposer
          target={{ path, line, author: root.author }}
          onSend={(body) => reply.send(root.id, body)}
          onCancel={reply.cancel}
        />
      )}
    </article>
  );
}

function ReplyItem({
  reply,
  arrived,
  onArrived,
}: {
  reply: ReviewComment;
  arrived: boolean;
  onArrived: () => void;
}) {
  const itemRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!arrived) return;
    itemRef.current?.scrollIntoView({ block: "center" });
    onArrived();
  }, [arrived, onArrived]);

  return (
    <div ref={itemRef} id={`comment-${reply.id}`} className="flex flex-col gap-1 border-l-2 pl-3">
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <span className="font-medium text-foreground">{reply.author}</span>
        <span>{relativeTime(reply.createdAt)}</span>
      </div>
      <Markdown text={reply.body} className="wrap-anywhere" />
    </div>
  );
}

function replyCount(count: number): string {
  return count === 1 ? "1 reply" : `${count} replies`;
}

function replyLabel(path: string, line: number | null): string {
  return line === null ? `Reply to ${path}` : `Reply to ${path} line ${line}`;
}

function ReceiptRow({ label, postedAt, url }: { label: string; postedAt: string; url: string }) {
  return (
    <article className="flex flex-wrap items-center gap-2 rounded-md border p-3 text-xs text-muted-foreground">
      <span className="font-medium text-foreground">{label}</span>
      <span>{relativeTime(postedAt)}</span>
      <a href={url} target="_blank" rel="noreferrer" className="underline">
        Open
      </a>
    </article>
  );
}
