"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { AssistAction, LineRange } from "@/lib/assist-protocol";
import type { PullRequestRef } from "@/lib/types";
import { streamAssist } from "./api";
import {
  askedThread,
  type AssistThread,
  awaitsQuestion,
  canFollowUp,
  openThread,
  threadRequest,
  withFollowUp,
  withModelText,
} from "./assist-thread";

export function useAssist(ref: PullRequestRef, headSha: string) {
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
      setThread(next);
      setStreaming(true);
      setError(null);
      const onText = (text: string) =>
        setThread((current) => current && withModelText(current, text));
      streamAssist(ref, headSha, threadRequest(next), onText, abort.signal)
        .catch((failure: Error) => {
          if (!abort.signal.aborted) setError(failure.message);
        })
        .finally(() => {
          if (controller.current === abort) setStreaming(false);
        });
    },
    [ref, headSha],
  );

  const open = useCallback(
    (range: LineRange, action: AssistAction) => {
      const next = openThread(range, action);
      if (!awaitsQuestion(next)) return run(next);
      stop();
      setError(null);
      setThread(next);
    },
    [run, stop],
  );

  const send = useCallback(
    (text: string) => {
      if (!thread) return;
      if (awaitsQuestion(thread)) run(askedThread(thread, text));
      else if (canFollowUp(thread)) run(withFollowUp(thread, text));
    },
    [run, thread],
  );

  const close = useCallback(() => {
    stop();
    setThread(null);
  }, [stop]);

  return { thread, streaming, error, open, send, stop, close };
}

export type Assist = ReturnType<typeof useAssist>;
