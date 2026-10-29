"use client";

import { useState } from "react";
import { PrDescription } from "@/components/common/pr-description";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { LinkedIssue } from "@/lib/github/gh";

function issueLabel(issue: LinkedIssue): string {
  return `${issue.owner}/${issue.repo}#${issue.number}`;
}

function LinkedIssueRow({ issue }: { issue: LinkedIssue }) {
  const [shown, setShown] = useState(false);
  const hasBody = issue.bodyHtml.trim() !== "";
  return (
    <li className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="text-muted-foreground">Closes</span>
        <a
          href={issue.url}
          target="_blank"
          rel="noreferrer"
          className="font-medium underline-offset-4 hover:underline"
        >
          {issueLabel(issue)}
        </a>
        <span className="min-w-0 wrap-anywhere">{issue.title}</span>
        {issue.state === "closed" && <Badge variant="secondary">Closed</Badge>}
        {hasBody && (
          <Button variant="link" size="xs" aria-expanded={shown} onClick={() => setShown(!shown)}>
            {shown ? "Hide issue" : "Show issue"}
          </Button>
        )}
      </div>
      {shown && hasBody && <PrDescription html={issue.bodyHtml} />}
    </li>
  );
}

export function LinkedIssues({ issues }: { issues: LinkedIssue[] }) {
  if (issues.length === 0) return null;
  return (
    <ul aria-label="Issues this PR closes" className="flex flex-col gap-3">
      {issues.map((issue) => (
        <LinkedIssueRow key={issueLabel(issue)} issue={issue} />
      ))}
    </ul>
  );
}
