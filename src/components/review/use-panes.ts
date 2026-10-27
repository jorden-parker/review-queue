"use client";

import { useCallback, useRef, useState } from "react";
import {
  closePane,
  dropPane,
  onPaneSide,
  openPaneOnSide,
  type PaneId,
  type PaneLayout,
  type PanelSide,
  pickPane,
  type SideLayouts,
  showPane,
  splitPane,
} from "./pane-layout";

type PaneChange = (layout: PaneLayout, id: PaneId) => PaneLayout;

const NO_PANES: SideLayouts = { left: [], right: [] };
const DEFAULT_HIDDEN: SideLayouts = { left: ["chat"], right: ["step"] };

function isWideScreen(): boolean {
  return window.matchMedia?.("(min-width: 64rem)").matches ?? true;
}

function hasOpenPane(layouts: SideLayouts): boolean {
  return layouts.left.length > 0 || layouts.right.length > 0;
}

export function usePanes() {
  const [panes, setPanes] = useState<SideLayouts>(() => ({
    left: [],
    right: isWideScreen() ? ["step"] : [],
  }));
  const hiddenPanes = useRef<SideLayouts>(DEFAULT_HIDDEN);

  const togglePanel = useCallback((side: PanelSide) => {
    setPanes((layouts) => {
      if (layouts[side].length === 0) return { ...layouts, [side]: hiddenPanes.current[side] };
      hiddenPanes.current = { ...hiddenPanes.current, [side]: layouts[side] };
      return { ...layouts, [side]: [] };
    });
  }, []);

  const toggleAllPanels = useCallback(() => {
    setPanes((layouts) => {
      if (!hasOpenPane(layouts)) return hiddenPanes.current;
      hiddenPanes.current = layouts;
      return NO_PANES;
    });
  }, []);

  const updatePane = useCallback(
    (id: PaneId, change: PaneChange) => setPanes((layouts) => onPaneSide(layouts, id, change)),
    [],
  );

  const openPane = useCallback(
    (id: PaneId, change: PaneChange) =>
      setPanes((layouts) => openPaneOnSide(layouts, id, change, isWideScreen())),
    [],
  );

  return {
    panes,
    togglePanel,
    toggleAllPanels,
    pickPane: useCallback((id: PaneId) => openPane(id, pickPane), [openPane]),
    splitPane: useCallback((id: PaneId) => openPane(id, splitPane), [openPane]),
    showPane: useCallback((id: PaneId) => openPane(id, showPane), [openPane]),
    closePane: useCallback((id: PaneId) => updatePane(id, closePane), [updatePane]),
    dropPane: useCallback(
      (id: PaneId, index: number) =>
        updatePane(id, (layout, paneId) => dropPane(layout, paneId, index)),
      [updatePane],
    ),
  };
}
