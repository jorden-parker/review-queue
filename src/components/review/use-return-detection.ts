"use client";

import { useEffect, useRef } from "react";

const AWAY_THRESHOLD_MS = 5 * 60 * 1000;

export function useReturnDetection(onReturn: () => void): void {
  const hiddenAt = useRef<number | null>(null);
  const callback = useRef(onReturn);

  useEffect(() => {
    callback.current = onReturn;
  }, [onReturn]);

  useEffect(() => {
    function onVisibility() {
      if (document.hidden) {
        hiddenAt.current = Date.now();
        return;
      }
      if (hiddenAt.current && Date.now() - hiddenAt.current > AWAY_THRESHOLD_MS) callback.current();
      hiddenAt.current = null;
    }
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);
}
