import { ExternalLink } from "lucide-react";
import Link from "next/link";
import { connection } from "next/server";
import type { ReactNode } from "react";
import { InlineMarkdown } from "@/components/common/markdown-text";
import { EmptyState } from "@/components/common/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { HintButton } from "@/components/common/hint-button";
import { REVIEW_REQUEST_LIMIT, type ReviewRequest } from "@/lib/github/gh";
import { prKey, prPath } from "@/lib/pr-ref";
import { openPullRequests, reviewRequests, sessionStore } from "@/lib/review/services";
import { savedRepositories } from "@/lib/settings/repository-settings";
import type {
  InProgressSession,
  PauseState,
  ProgressSummary,
  RecentSubmission,
} from "@/lib/session/store";
import { HomeSessions } from "./home-sessions";
import { relativeTime } from "./in-progress-list";
import { POSTED_REVIEW_LIMIT, PostedList } from "./posted-list";
import { orderQueue, type QueueEntry } from "./queue";

function ProgressBadges({ entry }: { entry: QueueEntry }) {
  if (!entry.progress) return <Badge variant="outline">Not started</Badge>;
  return (
    <span className="flex flex-wrap justify-end gap-2">
      <Badge className="bg-accent text-accent-foreground">
        Resume, {entry.progress.doneCount} steps done
      </Badge>
      {entry.movedSinceVisit && <Badge variant="outline">Activity since your visit</Badge>}
    </span>
  );
}

function PausedNote({ pause }: { pause: PauseState }) {
  const note = pause.note.trim();
  return (
    <span className="flex flex-wrap items-center gap-2 text-sm">
      <span className="rounded-full bg-callout px-3 py-0.5 text-callout-foreground">
        {note ? `You were about to: ${note}` : "Paused"}
      </span>
      <span className="text-muted-foreground">{relativeTime(pause.at)}</span>
    </span>
  );
}

function InboxRow({ entry }: { entry: QueueEntry }) {
  const { request, progress } = entry;
  return (
    <li className="flex items-center">
      <Link
        href={prPath(request.ref)}
        className="flex min-w-0 flex-1 items-center gap-4 px-5 py-4 transition-colors duration-calm hover:border-foreground/20 hover:bg-accent focus-visible:bg-accent"
      >
        <span className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="font-semibold">
            <InlineMarkdown text={request.title} />
          </span>
          <span className="flex flex-wrap gap-x-3 text-sm text-muted-foreground">
            <span>{prKey(request.ref)}</span>
            <span>by {request.author}</span>
            <span>updated {relativeTime(request.updatedAt)}</span>
            {request.isDraft && <span>draft</span>}
          </span>
          {progress?.pause && <PausedNote pause={progress.pause} />}
        </span>
        <ProgressBadges entry={entry} />
      </Link>
      <div className="pr-4">
        <HintButton
          variant="ghost"
          size="icon-sm"
          hint="Open on GitHub"
          aria-label={`Open ${prKey(request.ref)} on GitHub`}
          asChild
        >
          <a href={request.url} target="_blank" rel="noopener noreferrer">
            <ExternalLink />
          </a>
        </HintButton>
      </div>
    </li>
  );
}

function QueueRows({ entries }: { entries: QueueEntry[] }) {
  const started = entries.filter((entry) => entry.progress);
  const notStarted = entries.filter((entry) => !entry.progress);
  return (
    <>
      {started.map((entry) => (
        <InboxRow key={prKey(entry.request.ref)} entry={entry} />
      ))}
      {started.length > 0 && notStarted.length > 0 && (
        <li className="px-5 py-2 text-sm font-medium text-muted-foreground">Not started</li>
      )}
      {notStarted.map((entry) => (
        <InboxRow key={prKey(entry.request.ref)} entry={entry} />
      ))}
    </>
  );
}

type Inbox = {
  requests: ReviewRequest[];
  requestsError: string | null;
  repositoryRequests: ReviewRequest[];
  repositoryError: string | null;
  hasRepositories: boolean;
  progress: Record<string, ProgressSummary>;
  inProgress: InProgressSession[];
  archived: InProgressSession[];
  posted: RecentSubmission[];
};

export function failureMessage(failure: unknown): string {
  return failure instanceof Error ? failure.message : String(failure);
}

async function loadInbox(): Promise<Inbox> {
  const store = sessionStore();
  const [waiting, repositories] = await Promise.allSettled([
    reviewRequests(),
    openPullRequests("others"),
  ]);
  const requests = waiting.status === "fulfilled" ? waiting.value : [];
  const waitingKeys = new Set(requests.map((request) => prKey(request.ref)));
  const repositoryRequests =
    repositories.status === "fulfilled"
      ? repositories.value.filter((request) => !waitingKeys.has(prKey(request.ref)))
      : [];
  const listedKeys = new Set([
    ...waitingKeys,
    ...repositoryRequests.map((request) => prKey(request.ref)),
  ]);
  return {
    requests,
    requestsError: waiting.status === "rejected" ? failureMessage(waiting.reason) : null,
    repositoryRequests,
    repositoryError:
      repositories.status === "rejected" ? failureMessage(repositories.reason) : null,
    hasRepositories: savedRepositories(store).length > 0,
    progress: store.progressSummaries([...listedKeys]),
    inProgress: store.inProgress().filter((session) => !listedKeys.has(session.key)),
    archived: store.archived().filter((session) => !listedKeys.has(session.key)),
    posted: store.recentSubmissions(POSTED_REVIEW_LIMIT),
  };
}

function QueueSection({
  title,
  count,
  action,
  children,
}: {
  title: string;
  count: number;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-bold">
          {title} <span className="tabular-nums text-muted-foreground">({count})</span>
        </h2>
        {action}
      </div>
      {children}
    </section>
  );
}

export function RequestQueue({
  title,
  action,
  requests,
  progress,
  error,
  emptyMessage,
}: {
  title: string;
  action?: ReactNode;
  requests: ReviewRequest[];
  progress: Record<string, ProgressSummary>;
  error: string | null;
  emptyMessage: ReactNode;
}) {
  if (error) {
    return (
      <QueueSection title={title} count={0} action={action}>
        <Card className="gap-2 px-5 text-sm border-destructive/40">
          <p>
            🔌 Couldn&apos;t reach GitHub through <code className="font-mono">gh</code>. Is it
            installed and logged in?
          </p>
          <p className="font-mono text-sm text-muted-foreground">{error}</p>
        </Card>
      </QueueSection>
    );
  }
  if (requests.length === 0) {
    return (
      <QueueSection title={title} count={0} action={action}>
        <div className="rounded-xl bg-card border">
          <EmptyState emoji="🌴">{emptyMessage}</EmptyState>
        </div>
      </QueueSection>
    );
  }
  return (
    <QueueSection title={title} count={requests.length} action={action}>
      {requests.length === REVIEW_REQUEST_LIMIT && (
        <p className="text-sm text-muted-foreground">Showing the first {REVIEW_REQUEST_LIMIT}</p>
      )}
      <ul className="divide-y overflow-hidden rounded-xl bg-card border">
        <QueueRows entries={orderQueue(requests, progress)} />
      </ul>
    </QueueSection>
  );
}

export async function InboxList() {
  await connection();
  const inbox = await loadInbox();
  return (
    <div className="flex flex-col gap-8">
      <RequestQueue
        title="Waiting for you"
        requests={inbox.requests}
        progress={inbox.progress}
        error={inbox.requestsError}
        emptyMessage="Nothing is waiting for your review. Enjoy it."
      />
      {inbox.hasRepositories ? (
        <RequestQueue
          title="Open in your repositories"
          action={
            <Button variant="ghost" size="sm" asChild className="text-muted-foreground">
              <Link href="/dependabot">Dependabot PRs</Link>
            </Button>
          }
          requests={inbox.repositoryRequests}
          progress={inbox.progress}
          error={inbox.repositoryError}
          emptyMessage="No open pull requests in your repositories."
        />
      ) : (
        <p className="text-sm text-muted-foreground">
          Pick repositories in{" "}
          <Link href="/settings" className="text-foreground underline underline-offset-4">
            Settings
          </Link>{" "}
          to see their open PRs here
        </p>
      )}
      <HomeSessions inProgress={inbox.inProgress} archived={inbox.archived} />
      <PostedList reviews={inbox.posted} />
    </div>
  );
}
