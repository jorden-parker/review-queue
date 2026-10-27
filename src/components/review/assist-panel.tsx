"use client";

import { Sparkles, Square, X } from "lucide-react";
import { useMemo, useState } from "react";
import { type CitationRenderer, Markdown } from "@/components/common/markdown-text";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { AssistThread, AssistTurn } from "@/lib/assist-protocol";
import type { NoteKind } from "@/lib/types";
import { actionLabel, awaitsQuestion, canFollowUp, questionPrompt } from "./assist-thread";
import { CitationChip, CitationWalk } from "./citation-walk";
import type { Citation } from "./citations";
import { NoteKindPicker } from "./note-composer";
import { useStickToBottom } from "./use-stick-to-bottom";
import type { Assist } from "./use-assist";

type AssistPanelProps = {
  assist: Assist;
  thread: AssistThread;
  label: string;
  commentLine: number | null;
  citationsOf: (text: string) => Citation[];
  onSaveNote: (line: number | null, kind: NoteKind, body: string) => void;
  onShowLines: () => void;
  onShowCitation: (citation: Citation) => void;
};

type TurnProps = {
  turn: AssistTurn;
  streaming: boolean;
  isLast: boolean;
  citationsOf: (text: string) => Citation[];
  onShowCitation: (citation: Citation) => void;
};

function ModelTurn({ turn, streaming, isLast, citationsOf, onShowCitation }: TurnProps) {
  const citations = useMemo(() => citationsOf(turn.text), [citationsOf, turn.text]);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const showCitation = (index: number) => {
    const citation = citations[index];
    if (!citation) return;
    setActiveIndex(index);
    onShowCitation(citation);
  };
  const renderer: CitationRenderer = {
    indexOf: (code) => {
      const index = citations.findIndex((citation) => citation.code === code);
      return index === -1 ? null : index;
    },
    render: (index, code) => {
      const citation = citations[index];
      if (!citation) return code;
      return (
        <CitationChip
          index={index}
          citation={citation}
          active={index === activeIndex}
          onShow={() => showCitation(index)}
        />
      );
    },
  };
  return (
    <div className="flex flex-col gap-2">
      <Markdown text={turn.text} className="flex flex-col gap-2" citations={renderer} />
      {streaming && <span className="h-4 w-1.5 animate-pulse bg-primary" aria-label="Writing" />}
      {isLast && !streaming && (
        <CitationWalk citations={citations} activeIndex={activeIndex} onStep={showCitation} />
      )}
    </div>
  );
}

function Turn(props: TurnProps) {
  if (props.turn.role === "reviewer") {
    return (
      <p className="self-end rounded-lg bg-accent px-3 py-2 text-accent-foreground">
        {props.turn.text}
      </p>
    );
  }
  return <ModelTurn {...props} />;
}

type ChatTurnsProps = Omit<TurnProps, "turn" | "streaming" | "isLast"> & {
  thread: AssistThread;
  streaming: boolean;
};

function ChatTurns({ thread, streaming, ...shared }: ChatTurnsProps) {
  const lastIndex = thread.turns.length - 1;
  return (
    <>
      {thread.turns.map((turn, index) => (
        <Turn
          key={index}
          turn={turn}
          streaming={streaming && index === lastIndex}
          isLast={index === lastIndex}
          {...shared}
        />
      ))}
    </>
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
  citationsOf,
  onSaveNote,
  onShowLines,
  onShowCitation,
}: AssistPanelProps) {
  const last = thread.turns.at(-1);
  const draftReady =
    thread.action === "comment" && !assist.streaming && last?.role === "model" && last.text.trim();
  const scrollKey = [thread.turns.length, last?.text.length, assist.streaming, assist.error].join(
    "|",
  );
  const { ref: listRef, onScroll, pin } = useStickToBottom(scrollKey);
  const send = (text: string) => {
    pin();
    assist.send(text);
  };
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
      <div
        ref={listRef}
        onScroll={onScroll}
        data-testid="chat-messages"
        className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-3 *:shrink-0"
      >
        <p className="text-xs text-muted-foreground">
          The model&apos;s guess, unverified. The PR author can sway it.
        </p>
        <ChatTurns
          thread={thread}
          streaming={assist.streaming}
          citationsOf={citationsOf}
          onShowCitation={onShowCitation}
        />
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
            onSend={send}
          />
        )}
      </footer>
    </section>
  );
}
