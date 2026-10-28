import type { RefObject } from "react";
import { Button } from "@/components/ui/button";
import type { InProgressSession } from "@/lib/session/store";
import { InProgressRow } from "./in-progress-list";

export function ArchivedList({
  sessions,
  busy,
  onRestore,
  summaryRef,
}: {
  sessions: InProgressSession[];
  busy: boolean;
  onRestore: (session: InProgressSession) => void;
  summaryRef: RefObject<HTMLElement | null>;
}) {
  if (sessions.length === 0) return null;
  return (
    <details>
      <summary ref={summaryRef} className="cursor-pointer text-lg font-bold">
        Archived <span className="text-muted-foreground">({sessions.length})</span>
      </summary>
      <div className="flex flex-col gap-3 pt-3">
        <p className="text-sm text-muted-foreground">
          Archived sessions stay out of &ldquo;Also in progress&rdquo; until you restore them or
          push a new commit to the PR.
        </p>
        <ul className="divide-y overflow-hidden rounded-xl bg-card ring-1 ring-border">
          {sessions.map((session) => (
            <InProgressRow
              key={session.key}
              session={session}
              control={
                <Button
                  variant="outline"
                  size="sm"
                  aria-label={`Restore ${session.key}`}
                  disabled={busy}
                  onClick={() => onRestore(session)}
                >
                  Restore
                </Button>
              }
            />
          ))}
        </ul>
      </div>
    </details>
  );
}
