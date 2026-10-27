"use client";

import {
  type KeyboardEvent,
  type PointerEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import type { PanelSide, SideLayouts } from "./pane-layout";
import {
  PANEL_WIDTH,
  clampPanelWidth,
  dragDelta,
  fittedPanelWidth,
  maxPanelWidth,
  nextWidthOnDoubleClick,
  widthAfterKey,
} from "./panel-width";

function storageKeyFor(side: PanelSide): string {
  return side === "right" ? "review-queue:panel-width" : "review-queue:panel-width:left";
}

function readSavedWidth(storageKey: string): number {
  try {
    const saved = Number(window.localStorage.getItem(storageKey));
    return saved > 0 ? clampPanelWidth(saved, window.innerWidth) : PANEL_WIDTH.default;
  } catch {
    return PANEL_WIDTH.default;
  }
}

function savedPanelWidth(side: PanelSide): number {
  return readSavedWidth(storageKeyFor(side));
}

function saveWidth(storageKey: string, width: number) {
  try {
    window.localStorage.setItem(storageKey, String(width));
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

export function usePanelWidth(side: PanelSide, reservedWidth: number) {
  const storageKey = storageKeyFor(side);
  const [storedWidth, setWidth] = useState(() => readSavedWidth(storageKey));
  const width = clampPanelWidth(storedWidth, window.innerWidth, reservedWidth);
  const [dragging, setDragging] = useState(false);
  const dragStart = useRef({ pointerX: 0, width: 0 });
  const contentRef = useRef<HTMLDivElement>(null);

  const commit = useCallback(
    (next: number) => {
      setWidth(next);
      saveWidth(storageKey, next);
    },
    [storageKey],
  );

  useEffect(() => {
    const reclamp = () =>
      setWidth((current) => clampPanelWidth(current, window.innerWidth, reservedWidth));
    window.addEventListener("resize", reclamp);
    return () => window.removeEventListener("resize", reclamp);
  }, [reservedWidth]);

  const onPointerDown = (event: PointerEvent<HTMLElement>) => {
    if (event.button !== 0) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    dragStart.current = { pointerX: event.clientX, width };
    setDragging(true);
    setResizingCursor(true);
  };

  const onPointerMove = (event: PointerEvent<HTMLElement>) => {
    if (!dragging) return;
    const moved = dragDelta(side, dragStart.current.pointerX, event.clientX);
    setWidth(clampPanelWidth(dragStart.current.width + moved, window.innerWidth, reservedWidth));
  };

  const onPointerUp = () => {
    if (!dragging) return;
    setDragging(false);
    setResizingCursor(false);
    saveWidth(storageKey, width);
  };

  const onDoubleClick = () => {
    const content = contentRef.current;
    if (!content) return;
    const fitted = fittedPanelWidth(
      width,
      contentOverflows(content),
      window.innerWidth,
      reservedWidth,
    );
    commit(nextWidthOnDoubleClick(width, fitted, window.innerWidth, reservedWidth));
  };

  const onKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    const next = widthAfterKey(
      width,
      event.key,
      event.shiftKey,
      window.innerWidth,
      side,
      reservedWidth,
    );
    if (next === null) return;
    event.preventDefault();
    commit(next);
  };

  return {
    width,
    dragging,
    maxWidth: maxPanelWidth(window.innerWidth, reservedWidth),
    contentRef,
    handlers: { onPointerDown, onPointerMove, onPointerUp, onDoubleClick, onKeyDown },
  };
}

export function usePanelSizings(panes: SideLayouts) {
  const leftOpen = panes.left.length > 0;
  const rightOpen = panes.right.length > 0;
  const left = usePanelWidth("left", rightOpen ? savedPanelWidth("right") : 0);
  const right = usePanelWidth("right", leftOpen ? savedPanelWidth("left") : 0);
  return { left, right };
}
