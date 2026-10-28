"use client";

import { useEffect, useState } from "react";
import { orderedRange } from "@/lib/assist-protocol";
import { type LineSelection, sameLineSelection } from "./line-selection-state";
import { toolbarTop } from "./toolbar-position";

export type { LineSelection } from "./line-selection-state";

function lineOf(node: Node | null) {
  const element = node instanceof Element ? node : node?.parentElement;
  const row = element?.closest<HTMLElement>("[data-line]");
  if (!row) return null;
  return {
    path: row.dataset.path ?? "",
    hunk: Number(row.dataset.hunk),
    line: Number(row.dataset.line),
  };
}

function currentSelection(): LineSelection | null {
  const selection = document.getSelection();
  if (!selection || selection.isCollapsed || selection.rangeCount === 0) return null;
  const anchor = lineOf(selection.anchorNode);
  const focus = lineOf(selection.focusNode);
  const range = anchor && focus ? orderedRange(anchor, focus) : null;
  if (!range) return null;
  const box = selection.getRangeAt(0).getBoundingClientRect();
  return { range, top: toolbarTop(box, window.innerHeight), left: box.left };
}

export function useLineSelection(): LineSelection | null {
  const [selection, setSelection] = useState<LineSelection | null>(null);
  useEffect(() => {
    let frame: number | null = null;
    let shown: LineSelection | null = null;
    const refresh = () => {
      frame = null;
      const next = currentSelection();
      if (sameLineSelection(shown, next)) return;
      shown = next;
      setSelection(next);
    };
    const scheduleRefresh = () => {
      if (frame === null) frame = requestAnimationFrame(refresh);
    };
    document.addEventListener("selectionchange", scheduleRefresh);
    document.addEventListener("scroll", scheduleRefresh, { capture: true, passive: true });
    return () => {
      if (frame !== null) cancelAnimationFrame(frame);
      document.removeEventListener("selectionchange", scheduleRefresh);
      document.removeEventListener("scroll", scheduleRefresh, { capture: true });
    };
  }, []);
  return selection;
}
