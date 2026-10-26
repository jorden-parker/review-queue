"use client";

import { useEffect, useState } from "react";
import { type LineRange, orderedRange } from "@/lib/assist-protocol";
import { toolbarTop } from "./toolbar-position";

export type LineSelection = { range: LineRange; top: number; left: number };

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
    const update = () => setSelection(currentSelection());
    document.addEventListener("selectionchange", update);
    document.addEventListener("scroll", update, { capture: true, passive: true });
    return () => {
      document.removeEventListener("selectionchange", update);
      document.removeEventListener("scroll", update, { capture: true });
    };
  }, []);
  return selection;
}
