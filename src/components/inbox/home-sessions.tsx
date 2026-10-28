"use client";

import { useRef, useState } from "react";
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
}: {
  inProgress: InProgressSession[];
  archived: InProgressSession[];
}) {
  const [active, setActive] = useState(inProgress);
  const [stored, setStored] = useState(archived);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const archivedSummary = useRef<HTMLElement>(null);
  const activeHeading = useRef<HTMLHeadingElement>(null);

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
      <ArchivedList
        sessions={stored}
        busy={busy}
        onRestore={(session) => runChange(session, "unarchive")}
        summaryRef={archivedSummary}
      />
    </div>
  );
}
