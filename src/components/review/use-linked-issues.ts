"use client";

import { useEffect, useState } from "react";
import type { LinkedIssue } from "@/lib/github/gh";
import type { PullRequestRef } from "@/lib/types";
import { fetchLinkedIssues } from "./api";

function messageOf(failure: unknown): string {
  return failure instanceof Error ? failure.message : String(failure);
}

export function useLinkedIssues(ref: PullRequestRef) {
  const [issues, setIssues] = useState<LinkedIssue[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let current = true;
    fetchLinkedIssues(ref).then(
      (loaded) => {
        if (current) setIssues(loaded.issues);
      },
      (failure: unknown) => {
        if (current) setError(messageOf(failure));
      },
    );
    return () => {
      current = false;
    };
  }, [ref]);

  return { issues, error };
}
