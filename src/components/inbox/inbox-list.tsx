import Link from "next/link";
import { connection } from "next/server";
import { listReviewRequests, type ReviewRequest } from "@/lib/github/gh";
import { prKey, prPath } from "@/lib/pr-ref";
import { sessionStore } from "@/lib/review/services";
import type { ProgressSummary } from "@/lib/session/store";

function relativeTime(iso: string): string {
  const hours = Math.round((Date.now() - Date.parse(iso)) / 3_600_000);
  if (hours < 1) return "just now";
  if (hours < 48) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

function ProgressBadge({ progress }: { progress?: ProgressSummary }) {
  if (!progress) return <span className="text-sm text-muted">Not started</span>;
  return (
    <span className="rounded-full bg-accent-soft px-2 py-0.5 text-sm font-bold text-accent">
      Resume · {progress.doneCount} steps done
    </span>
  );
}

function InboxRow({ request, progress }: { request: ReviewRequest; progress?: ProgressSummary }) {
  return (
    <li>
      <Link
        href={prPath(request.ref)}
        className="flex flex-col gap-1 rounded-xl border border-line bg-panel p-4 hover:border-accent"
      >
        <span className="flex items-center justify-between gap-4">
          <span className="font-bold">{request.title}</span>
          <ProgressBadge progress={progress} />
        </span>
        <span className="text-sm text-muted">
          {prKey(request.ref)} · {request.author} · updated {relativeTime(request.updatedAt)}
          {request.isDraft && " · draft"}
        </span>
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
    const requests = await listReviewRequests();
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
      <p className="rounded-xl border border-high p-4 text-sm">
        Couldn&apos;t reach GitHub through <code>gh</code>. Is it installed and logged in?
        <br />
        <span className="text-muted">{error}</span>
      </p>
    );
  }
  if (requests.length === 0) {
    return <p className="text-muted">Nothing is waiting for your review. Enjoy it.</p>;
  }
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-lg font-bold">Waiting for you ({requests.length})</h2>
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
