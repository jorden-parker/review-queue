import Link from "next/link";
import { connection } from "next/server";
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
      Resume · {progress.doneCount} steps done
    </Badge>
  );
}

function InboxRow({ request, progress }: { request: ReviewRequest; progress?: ProgressSummary }) {
  return (
    <li>
      <Link href={prPath(request.ref)} className="group block rounded-xl focus-visible:outline-2">
        <Card className="gap-1.5 px-4 transition-[box-shadow,transform] duration-200 ease-spring group-hover:-translate-y-0.5 group-hover:shadow-lg group-hover:ring-primary/40">
          <span className="flex items-center justify-between gap-4">
            <span className="font-medium">
              <InlineMarkdown text={request.title} />
            </span>
            <ProgressBadge progress={progress} />
          </span>
          <span className="font-mono text-xs text-muted-foreground">
            {prKey(request.ref)} · {request.author} · updated {relativeTime(request.updatedAt)}
            {request.isDraft && " · draft"}
          </span>
        </Card>
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

export async function InboxList() {
  await connection();
  const { requests, progress, error } = await loadInbox();
  if (error) {
    return (
      <Card className="gap-1 px-4 text-sm ring-destructive/40">
        <p>
          🔌 Couldn&apos;t reach GitHub through <code className="font-mono">gh</code>. Is it
          installed and logged in?
        </p>
        <p className="font-mono text-xs text-muted-foreground">{error}</p>
      </Card>
    );
  }
  if (requests.length === 0) {
    return <EmptyState emoji="🌴">Nothing is waiting for your review. Enjoy it.</EmptyState>;
  }
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-sm font-medium text-muted-foreground">
        Waiting for you ({requests.length})
      </h2>
      <ul className="flex flex-col gap-3">
        {requests.map((request) => (
          <InboxRow
            key={prKey(request.ref)}
            request={request}
            progress={progress[prKey(request.ref)]}
          />
        ))}
      </ul>
    </section>
  );
}
