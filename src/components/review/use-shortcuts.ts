"use client";

import { useEffect, useRef } from "react";
import { resolveShortcut, type ShortcutAction } from "./shortcut-keys";

function isTyping(target: EventTarget | null): boolean {
  const element = target as HTMLElement | null;
  return (
    !!element &&
    (element.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(element.tagName))
  );
}

export function useShortcuts(onAction: (action: ShortcutAction) => void, enabled: boolean): void {
  const pending = useRef<string | null>(null);
  const handler = useRef(onAction);

  useEffect(() => {
    handler.current = onAction;
  }, [onAction]);

  useEffect(() => {
    if (!enabled) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.metaKey || event.ctrlKey || event.altKey || isTyping(event.target)) return;
      const result = resolveShortcut(pending.current, event.key);
      pending.current = result === "pending" ? event.key : null;
      if (!result || result === "pending") return;
      event.preventDefault();
      handler.current(result);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [enabled]);
}
