"use client";

import { useCallback, useRef, useState } from "react";
import {
  closePane,
  dropPane,
  type PaneId,
  type PaneLayout,
  pickPane,
  showPane,
  splitPane,
} from "./pane-layout";

const DEFAULT_LAYOUT: PaneLayout = ["step"];

function startsWithPanelOpen(): boolean {
  return window.matchMedia?.("(min-width: 64rem)").matches ?? true;
}

export function usePanes() {
  const [panes, setPanes] = useState<PaneLayout>(() =>
    startsWithPanelOpen() ? DEFAULT_LAYOUT : [],
  );
  const hiddenPanes = useRef<PaneLayout>(DEFAULT_LAYOUT);
  const togglePanel = useCallback(() => {
    setPanes((layout) => {
      if (layout.length === 0) return hiddenPanes.current;
      hiddenPanes.current = layout;
      return [];
    });
  }, []);
  return {
    panes,
    togglePanel,
    pickPane: useCallback((id: PaneId) => setPanes((layout) => pickPane(layout, id)), []),
    splitPane: useCallback((id: PaneId) => setPanes((layout) => splitPane(layout, id)), []),
    showPane: useCallback((id: PaneId) => setPanes((layout) => showPane(layout, id)), []),
    closePane: useCallback((id: PaneId) => setPanes((layout) => closePane(layout, id)), []),
    dropPane: useCallback(
      (id: PaneId, index: number) => setPanes((layout) => dropPane(layout, id, index)),
      [],
    ),
  };
}
