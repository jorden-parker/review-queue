"use client";

import { useCallback, useState } from "react";
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

export function usePeek(ref: PullRequestRef, headSha: string | null, onDefinitions: OnDefinitions) {
  const [peek, setPeek] = useState<PeekState | null>(null);

  const fail = useCallback(
    (error: unknown) =>
      setPeek((current) => (current ? { ...current, error: errorText(error) } : current)),
    [],
  );

  const loadReferences = useCallback(
    (position: SymbolPosition) => {
      if (!headSha) return;
      fetchReferences(ref, headSha, position)
        .then((references) =>
          setPeek((current) =>
            current?.position === position ? { ...current, references } : current,
          ),
        )
        .catch(fail);
    },
    [ref, headSha, fail],
  );

  const showReferences = useCallback(
    (position: SymbolPosition) => {
      if (!headSha) return;
      setPeek((current) => ({
        position,
        tab: "references",
        definitions: current?.position === position ? current.definitions : null,
        references: null,
        error: null,
      }));
      loadReferences(position);
    },
    [headSha, loadReferences],
  );

  const showDefinitions = useCallback(
    (position: SymbolPosition) => {
      if (!headSha) return;
      setPeek({ position, tab: "definitions", definitions: null, references: null, error: null });
      loadReferences(position);
      fetchDefinitions(ref, headSha, position)
        .then((definitions) => {
          setPeek((current) =>
            current?.position === position ? { ...current, definitions } : current,
          );
          onDefinitions(position, definitions);
          if (definitions.length === 0) showReferences(position);
        })
        .catch(fail);
    },
    [ref, headSha, fail, showReferences, loadReferences, onDefinitions],
  );

  const close = useCallback(() => setPeek(null), []);

  return { peek, showDefinitions, showReferences, close };
}
