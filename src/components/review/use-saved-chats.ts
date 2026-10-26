"use client";

import { useCallback } from "react";
import type { AssistThread } from "@/lib/assist-protocol";
import { withoutSavedChat, withSavedChat } from "./saved-chats";
import type { Act } from "./use-step-navigation";

export function useSavedChats(act: Act) {
  const save = useCallback(
    (thread: AssistThread) => {
      const updatedAt = new Date().toISOString();
      act({ type: "assist-save", thread }, (current) => withSavedChat(current, thread, updatedAt));
    },
    [act],
  );

  const remove = useCallback(
    (id: string) => act({ type: "assist-delete", id }, (current) => withoutSavedChat(current, id)),
    [act],
  );

  return { save, remove };
}
