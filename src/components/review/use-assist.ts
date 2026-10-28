"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { AssistAction, AssistTarget, AssistThread } from "@/lib/assist-protocol";
import type { PullRequestRef } from "@/lib/types";
import type { ParsedAssistStream } from "./assist-stream";
import { streamAssist } from "./api";
import {
  askedThread,
  awaitsQuestion,
  awaitsReply,
  canFollowUp,
  hasModelReply,
  openThread,
  threadRequest,
  withFollowUp,
  withModelText,
} from "./assist-thread";

export function useAssist(
  ref: PullRequestRef,
  headSha: string,
  onSave: (thread: AssistThread) => void,
) {
  const [thread, setThread] = useState<AssistThread | null>(null);
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const controller = useRef<AbortController | null>(null);

  const stop = useCallback(() => {
    controller.current?.abort();
    controller.current = null;
    setStreaming(false);
  }, []);

  useEffect(() => stop, [stop]);

  const run = useCallback(
    (next: AssistThread) => {
      controller.current?.abort();
      const abort = new AbortController();
      controller.current = abort;
      let latest = next;
      setThread(next);
      setStreaming(true);
      setError(null);
      const onUpdate = ({ text, lookups }: ParsedAssistStream) => {
        if (abort.signal.aborted) return;
        latest = withModelText(latest, text, lookups);
        setThread((current) => (current?.id === latest.id ? latest : current));
      };
      streamAssist(ref, headSha, threadRequest(next), onUpdate, abort.signal)
        .catch((failure: Error) => {
          if (!abort.signal.aborted) setError(failure.message);
        })
        .finally(() => {
          if (controller.current === abort) setStreaming(false);
          if (hasModelReply(latest)) onSave(latest);
        });
    },
    [ref, headSha, onSave],
  );

  const open = useCallback(
    (target: AssistTarget, action: AssistAction, opener?: string) => {
      const next = openThread(target, action, headSha, opener);
      if (!awaitsQuestion(next)) return run(next);
      stop();
      setError(null);
      setThread(next);
    },
    [run, stop, headSha],
  );

  const reopen = useCallback(
    (saved: AssistThread) => {
      stop();
      setError(null);
      setThread(saved);
    },
    [stop],
  );

  const readOnly = thread !== null && thread.headSha !== headSha;

  const send = useCallback(
    (text: string) => {
      if (!thread || readOnly) return;
      if (awaitsQuestion(thread)) run(askedThread(thread, text));
      else if (canFollowUp(thread)) run(withFollowUp(thread, text));
    },
    [run, thread, readOnly],
  );

  const retry = useCallback(() => {
    if (!thread || readOnly || !awaitsReply(thread)) return;
    run(thread);
  }, [run, thread, readOnly]);

  const close = useCallback(() => {
    stop();
    setThread(null);
  }, [stop]);

  return { thread, streaming, error, readOnly, open, reopen, send, retry, stop, close };
}

export type Assist = ReturnType<typeof useAssist>;
