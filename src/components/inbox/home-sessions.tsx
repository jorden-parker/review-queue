"use client";

import { type ReactNode, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { sendSessionAction } from "@/components/review/api";
import { parsePullRequestRef } from "@/lib/pr-ref";
import type { InProgressSession } from "@/lib/session/store";
import { ArchivedList } from "./archived-list";
import { InProgressList } from "./in-progress-list";

type Change = "archive" | "unarchive";

function withoutSession(sessions: InProgressSession[], key: string): InProgressSession[] {
  return sessions.filter((session) => session.key !== key);
}

function withSessionAdded(
  sessions: InProgressSession[],
  session: InProgressSession,
): InProgressSession[] {
  return [...sessions, session].sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt));
}

export function HomeSessions({
  inProgress,
  archived,
  children,
}: {
  inProgress: InProgressSession[];
  archived: InProgressSession[];
  children?: ReactNode;
}) {
  const [active, setActive] = useState(inProgress);
  const [stored, setStored] = useState(archived);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const archivedSummary = useRef<HTMLElement>(null);
  const activeHeading = useRef<HTMLHeadingElement>(null);
  const fold = useRef<HTMLDetailsElement>(null);

  function applyMove(session: InProgressSession, change: Change) {
    if (change === "archive") {
      setActive((rows) => withoutSession(rows, session.key));
      setStored((rows) => withSessionAdded(rows, session));
      return;
    }
    setStored((rows) => withoutSession(rows, session.key));
    setActive((rows) => withSessionAdded(rows, session));
  }

  async function runChange(session: InProgressSession, change: Change) {
    const ref = parsePullRequestRef(session.key);
    if (!ref) return;
    setBusy(true);
    setError(null);
    try {
      await sendSessionAction(ref, { type: change });
      flushSync(() => applyMove(session, change));
      if (change === "archive" && fold.current) fold.current.open = true;
      (change === "archive" ? archivedSummary : activeHeading).current?.focus();
    } catch {
      setError(
        `Couldn't ${change === "archive" ? "archive" : "restore"} ${session.key}. Try again.`,
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-8">
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <InProgressList
        sessions={active}
        busy={busy}
        onArchive={(session) => runChange(session, "archive")}
        headingRef={activeHeading}
      />
      <details ref={fold}>
        <summary className="flex min-h-11 cursor-pointer items-center text-sm font-medium text-muted-foreground">
          Open another PR, Dependabot, archive…
        </summary>
        <div className="flex flex-col gap-8 pt-6">
          {children}
          <ArchivedList
            sessions={stored}
            busy={busy}
            onRestore={(session) => runChange(session, "unarchive")}
            summaryRef={archivedSummary}
          />
        </div>
      </details>
    </div>
  );
}
