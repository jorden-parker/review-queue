import Link from "next/link";
import { InlineMarkdown } from "@/components/common/markdown-text";
import { Badge } from "@/components/ui/badge";
import { parsePullRequestRef, prPath } from "@/lib/pr-ref";
import type { InProgressSession } from "@/lib/session/store";

export function relativeTime(iso: string): string {
  const hours = Math.round((Date.now() - Date.parse(iso)) / 3_600_000);
  if (hours < 1) return "just now";
  if (hours < 48) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

function InProgressRow({ session }: { session: InProgressSession }) {
  const ref = parsePullRequestRef(session.key);
  const body = (
    <>
      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="font-bold">
          <InlineMarkdown text={session.title ?? session.key} />
        </span>
        <span className="flex flex-wrap gap-x-3 text-sm text-muted-foreground">
          <span>{session.key}</span>
          <span>updated {relativeTime(session.updatedAt)}</span>
          {session.pauseNote && <span>&ldquo;{session.pauseNote}&rdquo;</span>}
        </span>
      </span>
      <Badge className="bg-accent text-accent-foreground">
        Resume, {session.doneCount} steps done
      </Badge>
    </>
  );
  return (
    <li>
      {ref ? (
        <Link
          href={prPath(ref)}
          className="flex items-center gap-4 px-5 py-4 transition-colors duration-calm hover:bg-accent/60 focus-visible:bg-accent/60 focus-visible:outline-none"
        >
          {body}
        </Link>
      ) : (
        <div className="flex items-center gap-4 px-5 py-4">{body}</div>
      )}
    </li>
  );
}

export function InProgressList({ sessions }: { sessions: InProgressSession[] }) {
  if (sessions.length === 0) return null;
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-lg font-bold">
        Also in progress <span className="text-muted-foreground">({sessions.length})</span>
      </h2>
      <ul className="divide-y overflow-hidden rounded-xl bg-card ring-1 ring-border">
        {sessions.map((session) => (
          <InProgressRow key={session.key} session={session} />
        ))}
      </ul>
    </section>
  );
}
