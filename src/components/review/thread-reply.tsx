"use client";

import { type KeyboardEvent, useState } from "react";
import { AppDialog } from "@/components/common/app-dialog";
import { Markdown } from "@/components/common/markdown-text";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { REPLY_MAX_LENGTH } from "@/lib/types";

type ReplyTarget = { path: string; line: number | null; author: string };

type ThreadReplyComposerProps = {
  target: ReplyTarget;
  onSend: (body: string) => Promise<void>;
  onCancel: () => void;
};

export function ThreadReplyComposer({ target, onSend, onCancel }: ThreadReplyComposerProps) {
  const [body, setBody] = useState("");
  const [confirming, setConfirming] = useState(false);
  const trimmed = body.trim();

  function handleKey(event: KeyboardEvent<HTMLTextAreaElement>) {
    event.stopPropagation();
    if (event.key === "Escape") onCancel();
    if (event.key === "Enter" && (event.metaKey || event.ctrlKey) && trimmed) setConfirming(true);
  }

  return (
    <div className="flex flex-col gap-2 border-t pt-3">
      <Textarea
        aria-label="Reply text"
        autoFocus
        rows={3}
        maxLength={REPLY_MAX_LENGTH}
        value={body}
        onChange={(event) => setBody(event.target.value)}
        onKeyDown={handleKey}
        placeholder="Write a reply. Markdown works. ⌘↵ to continue, Esc to cancel"
      />
      <p className="text-xs text-muted-foreground">
        <span>{`${body.length}/${REPLY_MAX_LENGTH}`}</span> · Markdown works
      </p>
      <div className="flex justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={onCancel}>
          Cancel
        </Button>
        <Button size="sm" disabled={!trimmed} onClick={() => setConfirming(true)}>
          Post reply
        </Button>
      </div>
      {confirming && (
        <ReplyConfirmDialog
          target={target}
          body={trimmed}
          onNotYet={() => setConfirming(false)}
          onSend={onSend}
        />
      )}
    </div>
  );
}

function targetLine({ path, line, author }: ReplyTarget): string {
  const location = line === null ? `On ${path} (outdated thread)` : `On ${path} line ${line}`;
  return `${location}, replying to ${author}.`;
}

function ReplyConfirmDialog({
  target,
  body,
  onNotYet,
  onSend,
}: {
  target: ReplyTarget;
  body: string;
  onNotYet: () => void;
  onSend: (body: string) => Promise<void>;
}) {
  const [sending, setSending] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  async function send() {
    setSending(true);
    setFailure(null);
    try {
      await onSend(body);
    } catch (error) {
      setFailure(error instanceof Error ? error.message : String(error));
      setSending(false);
    }
  }

  return (
    <AppDialog title="Post this reply to GitHub?" onClose={onNotYet}>
      <p className="text-sm text-muted-foreground">{targetLine(target)}</p>
      <p className="text-xs font-medium text-muted-foreground">Preview</p>
      <Markdown text={body} className="wrap-anywhere" />
      {failure && <p className="text-sm text-destructive">{failure}</p>}
      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={onNotYet}>
          Not yet
        </Button>
        <Button disabled={sending} onClick={send}>
          {sending ? "Posting…" : "Post to GitHub"}
        </Button>
      </div>
    </AppDialog>
  );
}
