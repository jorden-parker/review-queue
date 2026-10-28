"use client";

import { useCallback, useRef } from "react";
import type { Jump, Session } from "@/lib/session/store";
import type { SymbolPosition } from "@/lib/types";
import type { LineTarget } from "./locate";
import type { Act } from "./use-step-navigation";

type Peek = { showDefinitions: (position: SymbolPosition) => void };

export function useJumps(
  session: Session,
  act: Act,
  openLocation: (target: LineTarget) => void,
  peek: Peek,
) {
  const origin = useRef<Jump | null>(null);

  const peekName = useCallback(
    (position: SymbolPosition) => {
      origin.current = { name: position.name, path: position.path, line: position.line };
      peek.showDefinitions(position);
    },
    [peek],
  );

  const goToFromPeek = useCallback(
    (target: LineTarget) => {
      const jump = origin.current;
      if (jump)
        act({ type: "jump-push", ...jump }, (current) => ({
          ...current,
          jumps: [...current.jumps, jump],
        }));
      openLocation(target);
    },
    [act, openLocation],
  );

  const back = useCallback(() => {
    const last = session.jumps.at(-1);
    if (!last) return;
    act({ type: "jump-pop" }, (current) => ({ ...current, jumps: current.jumps.slice(0, -1) }));
    openLocation({ path: last.path, line: last.line });
  }, [act, openLocation, session.jumps]);

  const clearJumps = useCallback(
    () => act({ type: "jump-clear" }, (current) => ({ ...current, jumps: [] })),
    [act],
  );

  return { peekName, goToFromPeek, back, clearJumps };
}
