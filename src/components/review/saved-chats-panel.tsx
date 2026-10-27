"use client";

import { Trash2 } from "lucide-react";
import { EmptyState } from "@/components/common/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { SavedAssistThread } from "@/lib/assist-protocol";
import { actionLabel } from "./assist-thread";

type SavedChatsPanelProps = {
  chats: SavedAssistThread[];
  headSha: string;
  labelOf: (chat: SavedAssistThread) => string;
  onOpen: (chat: SavedAssistThread) => void;
  onDelete: (id: string) => void;
};

export function SavedChatsPanel({
  chats,
  headSha,
  labelOf,
  onOpen,
  onDelete,
}: SavedChatsPanelProps) {
  if (chats.length === 0) {
    return (
      <EmptyState emoji="✨">
        Chats with the local model are kept here. Select lines or use “Ask about file” to start one.
      </EmptyState>
    );
  }
  return (
    <ul className="flex flex-col gap-0.5">
      {chats.map((chat) => (
        <ChatRow
          key={chat.id}
          chat={chat}
          label={labelOf(chat)}
          older={chat.headSha !== headSha}
          onOpen={onOpen}
          onDelete={onDelete}
        />
      ))}
    </ul>
  );
}

function ChatRow({
  chat,
  label,
  older,
  onOpen,
  onDelete,
}: {
  chat: SavedAssistThread;
  label: string;
  older: boolean;
  onOpen: (chat: SavedAssistThread) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <li className="group flex items-start gap-2 rounded-lg p-2 transition-colors duration-150 hover:bg-muted">
      <button
        onClick={() => onOpen(chat)}
        className="flex min-w-0 flex-1 flex-col gap-0.5 text-left text-sm"
      >
        <span className="wrap-anywhere">
          {chat.question ?? chat.turns[0]?.text ?? actionLabel(chat.action, chat.target)}
        </span>
        <span className="truncate font-mono text-xs text-muted-foreground">{label}</span>
        {older && (
          <Badge variant="outline" className="self-start">
            Older commit
          </Badge>
        )}
      </button>
      <Button
        variant="ghost"
        size="icon-xs"
        aria-label="Delete chat"
        onClick={() => onDelete(chat.id)}
        className="opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
      >
        <Trash2 />
      </Button>
    </li>
  );
}
