"use client";

import { useCallback, useRef, useState } from "react";
import type { DefinitionWithCode, ReferenceWithCode } from "@/lib/review/peek-code";
import type { PullRequestRef, SymbolPosition } from "@/lib/types";
import { fetchDefinitions, fetchReferences } from "./api";

export type PeekState = {
  position: SymbolPosition;
  tab: "definitions" | "references";
  definitions: DefinitionWithCode[] | null;
  references: ReferenceWithCode[] | null;
  error: string | null;
};

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

type OnDefinitions = (position: SymbolPosition, definitions: DefinitionWithCode[]) => void;

type PeekTab = PeekState["tab"];

type PeekRequest = { position: SymbolPosition };

export function usePeek(ref: PullRequestRef, headSha: string | null, onDefinitions: OnDefinitions) {
  const [peek, setPeek] = useState<PeekState | null>(null);
  const currentRequest = useRef<PeekRequest | null>(null);

  const updateIfCurrent = useCallback(
    (request: PeekRequest, change: (current: PeekState) => PeekState) => {
      if (currentRequest.current === request)
        setPeek((current) => (current ? change(current) : current));
    },
    [],
  );

  const failIfCurrent = useCallback(
    (request: PeekRequest, error: unknown) =>
      updateIfCurrent(request, (current) => ({ ...current, error: errorText(error) })),
    [updateIfCurrent],
  );

  const loadReferences = useCallback(
    (request: PeekRequest) => {
      if (!headSha) return;
      fetchReferences(ref, headSha, request.position)
        .then((references) => updateIfCurrent(request, (current) => ({ ...current, references })))
        .catch((error: unknown) => failIfCurrent(request, error));
    },
    [ref, headSha, updateIfCurrent, failIfCurrent],
  );

  const loadDefinitions = useCallback(
    (request: PeekRequest) => {
      if (!headSha) return;
      fetchDefinitions(ref, headSha, request.position)
        .then((definitions) => {
          onDefinitions(request.position, definitions);
          updateIfCurrent(request, (current) => ({
            ...current,
            definitions,
            tab:
              current.tab === "definitions" && definitions.length === 0
                ? "references"
                : current.tab,
          }));
        })
        .catch((error: unknown) => failIfCurrent(request, error));
    },
    [ref, headSha, onDefinitions, updateIfCurrent, failIfCurrent],
  );

  const startPeek = useCallback(
    (position: SymbolPosition, tab: PeekTab) => {
      const request: PeekRequest = { position };
      currentRequest.current = request;
      setPeek({ position, tab, definitions: null, references: null, error: null });
      loadReferences(request);
      if (tab === "definitions") loadDefinitions(request);
    },
    [loadReferences, loadDefinitions],
  );

  const showReferences = useCallback(
    (position: SymbolPosition) => {
      if (!headSha) return;
      if (currentRequest.current?.position === position) {
        setPeek((current) => (current ? { ...current, tab: "references" } : current));
        return;
      }
      startPeek(position, "references");
    },
    [headSha, startPeek],
  );

  const showDefinitions = useCallback(
    (position: SymbolPosition) => {
      if (!headSha) return;
      const request = currentRequest.current;
      if (request?.position !== position) {
        startPeek(position, "definitions");
        return;
      }
      setPeek((current) =>
        current ? { ...current, tab: "definitions", definitions: null } : current,
      );
      loadDefinitions(request);
    },
    [headSha, startPeek, loadDefinitions],
  );

  const close = useCallback(() => {
    currentRequest.current = null;
    setPeek(null);
  }, []);

  return { peek, showDefinitions, showReferences, close };
}
