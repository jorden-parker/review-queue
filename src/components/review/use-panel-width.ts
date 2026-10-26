"use client";

import {
  type KeyboardEvent,
  type PointerEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  PANEL_WIDTH,
  clampPanelWidth,
  fittedPanelWidth,
  nextWidthOnDoubleClick,
  widthAfterKey,
} from "./panel-width";

const STORAGE_KEY = "review-queue:panel-width";

function readSavedWidth(): number {
  try {
    const saved = Number(window.localStorage.getItem(STORAGE_KEY));
    return saved > 0 ? clampPanelWidth(saved, window.innerWidth) : PANEL_WIDTH.default;
  } catch {
    return PANEL_WIDTH.default;
  }
}

function saveWidth(width: number) {
  try {
    window.localStorage.setItem(STORAGE_KEY, String(width));
  } catch {
    return;
  }
}

function contentOverflows(content: HTMLElement): number[] {
  return Array.from(content.querySelectorAll<HTMLElement>("*"), (element) =>
    Math.max(0, element.scrollWidth - element.clientWidth),
  );
}

function setResizingCursor(resizing: boolean) {
  document.body.classList.toggle("cursor-col-resize", resizing);
  document.body.classList.toggle("select-none", resizing);
}

export function usePanelWidth() {
  const [width, setWidth] = useState(readSavedWidth);
  const [dragging, setDragging] = useState(false);
  const dragStart = useRef({ pointerX: 0, width: 0 });
  const contentRef = useRef<HTMLDivElement>(null);

  const commit = useCallback((next: number) => {
    setWidth(next);
    saveWidth(next);
  }, []);

  useEffect(() => {
    const reclamp = () => setWidth((current) => clampPanelWidth(current, window.innerWidth));
    window.addEventListener("resize", reclamp);
    return () => window.removeEventListener("resize", reclamp);
  }, []);

  const onPointerDown = (event: PointerEvent<HTMLElement>) => {
    if (event.button !== 0) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    dragStart.current = { pointerX: event.clientX, width };
    setDragging(true);
    setResizingCursor(true);
  };

  const onPointerMove = (event: PointerEvent<HTMLElement>) => {
    if (!dragging) return;
    const moved = dragStart.current.pointerX - event.clientX;
    setWidth(clampPanelWidth(dragStart.current.width + moved, window.innerWidth));
  };

  const onPointerUp = () => {
    if (!dragging) return;
    setDragging(false);
    setResizingCursor(false);
    saveWidth(width);
  };

  const onDoubleClick = () => {
    const content = contentRef.current;
    if (!content) return;
    const fitted = fittedPanelWidth(width, contentOverflows(content), window.innerWidth);
    commit(nextWidthOnDoubleClick(width, fitted, window.innerWidth));
  };

  const onKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    const next = widthAfterKey(width, event.key, event.shiftKey, window.innerWidth);
    if (next === null) return;
    event.preventDefault();
    commit(next);
  };

  return {
    width,
    dragging,
    contentRef,
    handlers: { onPointerDown, onPointerMove, onPointerUp, onDoubleClick, onKeyDown },
  };
}
