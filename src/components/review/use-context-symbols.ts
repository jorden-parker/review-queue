"use client";

import { useCallback } from "react";
import type { DefinitionWithCode } from "@/lib/review/peek-code";
import type { SeenSymbol } from "@/lib/session/store";
import type { SymbolPosition } from "@/lib/types";
import { seenSymbolOf, withSymbol } from "./context-symbols";
import type { Act } from "./use-step-navigation";

export function useContextSymbols(act: Act, stepId: string | null) {
  const recordSeen = useCallback(
    (definition: DefinitionWithCode, origin: SymbolPosition) => {
      const symbol = seenSymbolOf(definition, origin, stepId);
      act({ type: "symbol-seen", symbol }, (current) => ({
        ...current,
        contextSymbols: withSymbol(current.contextSymbols, symbol, {}),
      }));
    },
    [act, stepId],
  );

  const setPinned = useCallback(
    (symbol: SeenSymbol, pinned: boolean) =>
      act({ type: "symbol-pin", symbol, pinned }, (current) => ({
        ...current,
        contextSymbols: withSymbol(current.contextSymbols, symbol, { pinned }),
      })),
    [act],
  );

  return { recordSeen, setPinned };
}
