"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { threadsFor } from "./conversation-threads";
import type { Conversation } from "@/lib/github/conversation";
import type { PullRequestRef } from "@/lib/types";
import { fetchConversation } from "./api";

const NO_CONVERSATION: Conversation = { comments: [], reviews: [], truncated: false };

function messageOf(failure: unknown): string {
  return failure instanceof Error ? failure.message : String(failure);
}

export function useConversation(ref: PullRequestRef) {
  const [conversation, setConversation] = useState<Conversation>(NO_CONVERSATION);
  const [error, setError] = useState<string | null>(null);
  const threads = useMemo(() => threadsFor(conversation.comments), [conversation]);

  useEffect(() => {
    let current = true;
    fetchConversation(ref).then(
      (loaded) => {
        if (current) setConversation(loaded);
      },
      (failure: unknown) => {
        if (current) setError(messageOf(failure));
      },
    );
    return () => {
      current = false;
    };
  }, [ref]);

  const refreshConversation = useCallback(async () => {
    try {
      setConversation(await fetchConversation(ref));
      setError(null);
    } catch (failure) {
      setError(messageOf(failure));
    }
  }, [ref]);

  return { conversation, threads, conversationError: error, refreshConversation };
}
