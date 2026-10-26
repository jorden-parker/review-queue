"use client";

import { useCallback, useState } from "react";
import type { DefinitionWithCode, ReferenceWithCode } from "@/lib/review/peek-code";
import type { PullRequestRef } from "@/lib/types";
import { fetchDefinitions, fetchReferences } from "./api";

export type PeekState = {
  name: string;
  from: string;
  tab: "definitions" | "references";
  definitions: DefinitionWithCode[] | null;
  references: ReferenceWithCode[] | null;
  error: string | null;
};

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function usePeek(ref: PullRequestRef, headSha: string | null) {
  const [peek, setPeek] = useState<PeekState | null>(null);

  const showDefinitions = useCallback(
    (name: string, from: string) => {
      if (!headSha) return;
      setPeek({ name, from, tab: "definitions", definitions: null, references: null, error: null });
      fetchDefinitions(ref, headSha, name, from)
        .then((definitions) =>
          setPeek((current) => (current?.name === name ? { ...current, definitions } : current)),
        )
        .catch((error) =>
          setPeek((current) => (current ? { ...current, error: errorText(error) } : current)),
        );
    },
    [ref, headSha],
  );

  const showReferences = useCallback(
    (name: string, from: string) => {
      if (!headSha) return;
      setPeek((current) => ({
        name,
        from,
        tab: "references",
        definitions: current?.name === name ? current.definitions : null,
        references: null,
        error: null,
      }));
      fetchReferences(ref, headSha, name)
        .then((references) =>
          setPeek((current) => (current?.name === name ? { ...current, references } : current)),
        )
        .catch((error) =>
          setPeek((current) => (current ? { ...current, error: errorText(error) } : current)),
        );
    },
    [ref, headSha],
  );

  const close = useCallback(() => setPeek(null), []);

  return { peek, showDefinitions, showReferences, close };
}
