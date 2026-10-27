import Link from "next/link";
import { connection } from "next/server";
import type { ReactNode } from "react";
import { InlineMarkdown } from "@/components/common/markdown-text";
import { EmptyState } from "@/components/common/empty-state";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import type { ReviewRequest } from "@/lib/github/gh";
import { prKey, prPath } from "@/lib/pr-ref";
import { reviewRequests, sessionStore } from "@/lib/review/services";
import type { ProgressSummary } from "@/lib/session/store";

function relativeTime(iso: string): string {
  const hours = Math.round((Date.now() - Date.parse(iso)) / 3_600_000);
  if (hours < 1) return "just now";
  if (hours < 48) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

function ProgressBadge({ progress }: { progress?: ProgressSummary }) {
  if (!progress) return <Badge variant="outline">Not started</Badge>;
  return (
    <Badge className="bg-accent text-accent-foreground">
      Resume, {progress.doneCount} steps done
    </Badge>
  );
}

function InboxRow({ request, progress }: { request: ReviewRequest; progress?: ProgressSummary }) {
  return (
    <li>
      <Link
        href={prPath(request.ref)}
        className="flex items-center gap-4 px-5 py-4 transition-colors duration-calm hover:bg-accent/60 focus-visible:bg-accent/60 focus-visible:outline-none"
      >
        <span className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="font-bold">
            <InlineMarkdown text={request.title} />
          </span>
          <span className="flex flex-wrap gap-x-3 text-sm text-muted-foreground">
            <span>{prKey(request.ref)}</span>
            <span>by {request.author}</span>
            <span>updated {relativeTime(request.updatedAt)}</span>
            {request.isDraft && <span>draft</span>}
          </span>
        </span>
        <ProgressBadge progress={progress} />
      </Link>
    </li>
  );
}

type Inbox = {
  requests: ReviewRequest[];
  progress: Record<string, ProgressSummary>;
  error: string | null;
};

async function loadInbox(): Promise<Inbox> {
  try {
    const requests = await reviewRequests();
    const progress = sessionStore().progressSummaries(
      requests.map((request) => prKey(request.ref)),
    );
    return { requests, progress, error: null };
  } catch (error) {
    return {
      requests: [],
      progress: {},
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

function QueueSection({ count, children }: { count: number; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-lg font-bold">
        Waiting for you <span className="text-muted-foreground">({count})</span>
      </h2>
      {children}
    </section>
  );
}

export async function InboxList() {
  await connection();
  const { requests, progress, error } = await loadInbox();
  if (error) {
    return (
      <QueueSection count={0}>
        <Card className="gap-2 px-5 text-sm ring-destructive/40">
          <p>
            🔌 Couldn&apos;t reach GitHub through <code className="font-mono">gh</code>. Is it
            installed and logged in?
          </p>
          <p className="font-mono text-xs text-muted-foreground">{error}</p>
        </Card>
      </QueueSection>
    );
  }
  if (requests.length === 0) {
    return (
      <QueueSection count={0}>
        <div className="rounded-xl bg-card ring-1 ring-border">
          <EmptyState emoji="🌴">Nothing is waiting for your review. Enjoy it.</EmptyState>
        </div>
      </QueueSection>
    );
  }
  return (
    <QueueSection count={requests.length}>
      <ul className="divide-y overflow-hidden rounded-xl bg-card ring-1 ring-border">
        {requests.map((request) => (
          <InboxRow
            key={prKey(request.ref)}
            request={request}
            progress={progress[prKey(request.ref)]}
          />
        ))}
      </ul>
    </QueueSection>
  );
}
