"use client";

import { Sparkles, Square, X } from "lucide-react";
import { useState } from "react";
import { Markdown } from "@/components/common/markdown-text";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { AssistThread, AssistTurn } from "@/lib/assist-protocol";
import type { NoteKind } from "@/lib/types";
import { actionLabel, awaitsQuestion, canFollowUp, questionPrompt } from "./assist-thread";
import { NoteKindPicker } from "./note-composer";
import type { Assist } from "./use-assist";

type AssistPanelProps = {
  assist: Assist;
  thread: AssistThread;
  label: string;
  commentLine: number | null;
  onSaveNote: (line: number | null, kind: NoteKind, body: string) => void;
  onShowLines: () => void;
};

function Turn({ turn, streaming }: { turn: AssistTurn; streaming: boolean }) {
  if (turn.role === "reviewer") {
    return (
      <p className="self-end rounded-lg bg-accent px-3 py-2 text-accent-foreground">{turn.text}</p>
    );
  }
  return (
    <div className="flex flex-col gap-2">
      <Markdown text={turn.text} className="flex flex-col gap-2" />
      {streaming && <span className="h-4 w-1.5 animate-pulse bg-primary" aria-label="Writing" />}
    </div>
  );
}

function CommentDraft({
  draft,
  commentLine,
  onSave,
}: {
  draft: string;
  commentLine: number | null;
  onSave: (kind: NoteKind, body: string) => void;
}) {
  const [kind, setKind] = useState<NoteKind>("question");
  const [body, setBody] = useState(draft.trim());
  const [saved, setSaved] = useState(false);
  const save = () => {
    onSave(kind, body.trim());
    setSaved(true);
  };
  return (
    <div className="flex flex-col gap-2 rounded-lg border p-3">
      <NoteKindPicker kind={kind} onChange={setKind} />
      <Textarea
        aria-label="Comment draft"
        value={body}
        onChange={(event) => setBody(event.target.value)}
        rows={4}
      />
      <Button size="sm" className="self-end" disabled={saved || !body.trim()} onClick={save}>
        {saved
          ? "Saved to your notes"
          : commentLine === null
            ? "Save as summary note"
            : `Save as note on L${commentLine}`}
      </Button>
    </div>
  );
}

function Composer({
  thread,
  readOnly,
  onSend,
}: {
  thread: AssistThread;
  readOnly: boolean;
  onSend: (text: string) => void;
}) {
  const [text, setText] = useState("");
  const asking = awaitsQuestion(thread);
  if (readOnly) {
    return (
      <p className="text-xs text-muted-foreground">
        Asked on an older commit, so it can&apos;t be continued. Ask again to start fresh.
      </p>
    );
  }
  if (!asking && !canFollowUp(thread)) {
    return (
      <p className="text-xs text-muted-foreground">
        That&apos;s a long thread. Ask again to start fresh.
      </p>
    );
  }
  const send = () => {
    if (!text.trim()) return;
    onSend(text.trim());
    setText("");
  };
  return (
    <Textarea
      autoFocus={asking}
      aria-label="Ask the model"
      value={text}
      onChange={(event) => setText(event.target.value)}
      onKeyDown={(event) => {
        if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) send();
      }}
      rows={2}
      placeholder={`${(asking && questionPrompt(thread.action, thread.target)) || "Ask a follow-up"} (⌘↵ to send)`}
    />
  );
}

export function AssistPanel({
  assist,
  thread,
  label,
  commentLine,
  onSaveNote,
  onShowLines,
}: AssistPanelProps) {
  const last = thread.turns.at(-1);
  const draftReady =
    thread.action === "comment" && !assist.streaming && last?.role === "model" && last.text.trim();
  return (
    <section
      aria-label="Ask the model"
      className="flex min-h-0 flex-1 flex-col border-t bg-card font-sans text-sm"
      onKeyDown={(event) => event.stopPropagation()}
    >
      <header className="flex items-center gap-2 border-b px-3 py-2.5">
        <Sparkles size={14} className="shrink-0 text-primary" />
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="font-medium">{actionLabel(thread.action, thread.target)}</span>
          <button
            onClick={onShowLines}
            className="truncate text-left font-mono text-xs text-muted-foreground hover:text-foreground"
          >
            {label}
          </button>
        </div>
        <Button variant="ghost" size="icon-xs" aria-label="Close" onClick={assist.close}>
          <X />
        </Button>
      </header>
      <div className="scrollbar-hidden flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-3">
        <p className="text-xs text-muted-foreground">
          The model&apos;s guess, unverified. The PR author can sway it.
        </p>
        {thread.turns.map((turn, index) => (
          <Turn
            key={index}
            turn={turn}
            streaming={assist.streaming && index === thread.turns.length - 1}
          />
        ))}
        {assist.streaming && last?.role === "reviewer" && (
          <p className="text-muted-foreground">Local model is reading…</p>
        )}
        {assist.error && (
          <p className="rounded-lg bg-del px-3 py-2 text-del-foreground">
            Local model unavailable ({assist.error}).
          </p>
        )}
        {draftReady && (
          <CommentDraft
            key={last.text}
            draft={last.text}
            commentLine={commentLine}
            onSave={(kind, body) => onSaveNote(commentLine, kind, body)}
          />
        )}
      </div>
      <footer className="flex flex-col gap-2 border-t p-3">
        {assist.streaming ? (
          <Button variant="outline" size="sm" onClick={assist.stop}>
            <Square /> Stop
          </Button>
        ) : (
          <Composer
            key={thread.turns.length}
            thread={thread}
            readOnly={assist.readOnly}
            onSend={assist.send}
          />
        )}
      </footer>
    </section>
  );
}
