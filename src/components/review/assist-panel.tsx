"use client";

import { Sparkles, Square, X } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { NoteKind } from "@/lib/types";
import {
  ACTION_LABELS,
  type AssistThread,
  type AssistTurn,
  awaitsQuestion,
  canFollowUp,
  QUESTION_PROMPTS,
} from "./assist-thread";
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

function AssistText({ text }: { text: string }) {
  return text.split("```").map((part, index) =>
    index % 2 === 1 ? (
      <pre key={index} className="overflow-x-auto rounded-md bg-muted p-2 font-mono text-code">
        {part.replace(/^\w*\n/, "")}
      </pre>
    ) : (
      <p key={index} className="whitespace-pre-wrap">
        {part.trim()}
      </p>
    ),
  );
}

function Turn({ turn, streaming }: { turn: AssistTurn; streaming: boolean }) {
  if (turn.role === "reviewer") {
    return (
      <p className="self-end rounded-lg bg-accent px-3 py-2 text-accent-foreground">{turn.text}</p>
    );
  }
  return (
    <div className="flex flex-col gap-2">
      <AssistText text={turn.text} />
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

function Composer({ thread, onSend }: { thread: AssistThread; onSend: (text: string) => void }) {
  const [text, setText] = useState("");
  const asking = awaitsQuestion(thread);
  if (!asking && !canFollowUp(thread)) {
    return (
      <p className="text-xs text-muted-foreground">
        That&apos;s a long thread. Select the lines again to start fresh.
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
      placeholder={`${(asking && QUESTION_PROMPTS[thread.action]) || "Ask a follow-up"} (⌘↵ to send)`}
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
    <aside
      aria-label="Ask the model"
      className="flex min-h-0 flex-col border-l bg-card font-sans text-sm"
      onKeyDown={(event) => event.stopPropagation()}
    >
      <header className="flex items-center gap-2 border-b px-3 py-2.5">
        <Sparkles size={14} className="shrink-0 text-primary" />
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="font-medium">{ACTION_LABELS[thread.action]}</span>
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
          <p className="text-muted-foreground">Local model is reading these lines…</p>
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
          <Composer key={thread.turns.length} thread={thread} onSend={assist.send} />
        )}
      </footer>
    </aside>
  );
}
