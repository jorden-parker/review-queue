"use client";

import { useCallback, useRef } from "react";
import type { Jump, Session } from "@/lib/session/store";
import type { LineTarget } from "./locate";
import type { Act } from "./use-step-navigation";

type Peek = { showDefinitions: (name: string, from: string) => void };

export function useJumps(
  session: Session,
  act: Act,
  goTo: (target: LineTarget) => void,
  peek: Peek,
) {
  const origin = useRef<Jump | null>(null);

  const peekName = useCallback(
    (name: string, path: string, line: number) => {
      origin.current = { name, path, line };
      peek.showDefinitions(name, path);
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
      goTo(target);
    },
    [act, goTo],
  );

  const back = useCallback(() => {
    const last = session.jumps.at(-1);
    if (!last) return;
    act({ type: "jump-pop" }, (current) => ({ ...current, jumps: current.jumps.slice(0, -1) }));
    goTo({ path: last.path, line: last.line });
  }, [act, goTo, session.jumps]);

  const clearJumps = useCallback(
    () => act({ type: "jump-clear" }, (current) => ({ ...current, jumps: [] })),
    [act],
  );

  return { peekName, goToFromPeek, back, clearJumps };
}
