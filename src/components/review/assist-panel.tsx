"use client";

import { Search, Sparkles, Square, X } from "lucide-react";
import { useMemo, useState } from "react";
import { Callout } from "@/components/common/callout";
import { type CitationRenderer, InlineMarkdown, Markdown } from "@/components/common/markdown-text";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { MarkdownField } from "@/components/common/markdown-field";
import type { AssistLookup, AssistThread, AssistTurn } from "@/lib/assist-protocol";
import { splitConventionalPrefix, unwrappedDraft } from "@/lib/review/conventional-comment";
import type { NoteTag } from "@/lib/types";
import {
  actionLabel,
  awaitsQuestion,
  awaitsReply,
  canFollowUp,
  questionPrompt,
} from "./assist-thread";
import { CitationChip, CitationWalk } from "./citation-walk";
import type { Citation } from "./citations";
import { NoteTagPicker } from "./note-composer";
import { useStickToBottom } from "./use-stick-to-bottom";
import type { Assist } from "./use-assist";

type AssistPanelProps = {
  assist: Assist;
  thread: AssistThread;
  label: string;
  commentLine: number | null;
  citationsOf: (turn: AssistTurn) => Citation[];
  onSaveNote: (line: number | null, tag: NoteTag, body: string) => void;
  onShowLines: () => void;
  onShowCitation: (citation: Citation) => void;
};

type TurnProps = {
  turn: AssistTurn;
  streaming: boolean;
  isLast: boolean;
  citationsOf: (turn: AssistTurn) => Citation[];
  onShowCitation: (citation: Citation) => void;
};

function LookupList({ lookups = [] }: { lookups?: AssistLookup[] }) {
  if (lookups.length === 0) return null;
  return (
    <ul aria-label="Lookups" className="flex flex-col gap-0.5 text-xs text-muted-foreground">
      {lookups.map((lookup, index) => (
        <li key={index} className="flex items-start gap-1.5">
          <Search className="mt-0.5 size-3 shrink-0" aria-hidden />
          <span className="min-w-0">
            <InlineMarkdown text={lookup.label} />
          </span>
        </li>
      ))}
    </ul>
  );
}

function citationRenderer(
  citations: Citation[],
  activeIndex: number | null,
  showCitation: (index: number) => void,
): CitationRenderer {
  return {
    indexOf: (code) => {
      const index = citations.findIndex((citation) => citation.code === code);
      return index === -1 ? null : index;
    },
    render: (index, code) => {
      const citation = citations[index];
      if (!citation) return code;
      return (
        <CitationChip
          citation={citation}
          active={index === activeIndex}
          onShow={() => showCitation(index)}
        />
      );
    },
  };
}

function ModelTurn({ turn, streaming, isLast, citationsOf, onShowCitation }: TurnProps) {
  const citations = useMemo(() => citationsOf(turn), [citationsOf, turn]);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const showCitation = (index: number) => {
    const citation = citations[index];
    if (!citation) return;
    setActiveIndex(index);
    onShowCitation(citation);
  };
  return (
    <div className="flex flex-col gap-2">
      <LookupList lookups={turn.lookups} />
      <Markdown
        text={turn.text}
        className="flex flex-col gap-2"
        citations={citationRenderer(citations, activeIndex, showCitation)}
      />
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
      <Markdown
        text={props.turn.text}
        className="flex flex-col gap-2 self-end rounded-lg bg-accent px-3 py-2 text-accent-foreground"
      />
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
  onSave: (tag: NoteTag, body: string) => void;
}) {
  const parsed = splitConventionalPrefix(unwrappedDraft(draft));
  const [tag, setTag] = useState<NoteTag>(parsed.tag ?? { kind: "question", decorations: [] });
  const [body, setBody] = useState(parsed.body);
  const [saved, setSaved] = useState(false);
  const save = () => {
    onSave(tag, body.trim());
    setSaved(true);
  };
  return (
    <div className="flex flex-col gap-2 rounded-lg border p-3">
      <NoteTagPicker tag={tag} onChange={setTag} />
      <MarkdownField
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
  onRetry,
}: {
  thread: AssistThread;
  readOnly: boolean;
  onSend: (text: string) => void;
  onRetry: () => void;
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
    if (awaitsReply(thread)) {
      return (
        <Button variant="outline" size="sm" onClick={onRetry}>
          Retry
        </Button>
      );
    }
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
  const retry = () => {
    pin();
    assist.retry();
  };
  return (
    <section
      aria-label="Ask the model"
      className="flex min-h-0 flex-1 flex-col border-t bg-card font-sans text-sm"
      onKeyDown={(event) => event.stopPropagation()}
    >
      <header className="flex items-center gap-2 border-b px-3 py-2.5">
        <Sparkles className="size-3.5 shrink-0 text-primary" />
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="font-medium">{actionLabel(thread.action, thread.target)}</span>
          <button
            onClick={onShowLines}
            className="text-left font-mono text-xs wrap-anywhere text-muted-foreground hover:text-foreground"
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
        {assist.error && <Callout tone="error">Local model unavailable ({assist.error}).</Callout>}
        {draftReady && (
          <CommentDraft
            key={last.text}
            draft={last.text}
            commentLine={commentLine}
            onSave={(tag, body) => onSaveNote(commentLine, tag, body)}
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
            onRetry={retry}
          />
        )}
      </footer>
    </section>
  );
}
