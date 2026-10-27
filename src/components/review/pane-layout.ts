export type PaneId =
  "about" | "step" | "path" | "hotspots" | "notes" | "chat" | "chats" | "context" | "outline";
export type PaneLayout = PaneId[];

export function closePane(layout: PaneLayout, id: PaneId): PaneLayout {
  return layout.filter((pane) => pane !== id);
}

export function pickPane(layout: PaneLayout, id: PaneId): PaneLayout {
  return layout.includes(id) ? closePane(layout, id) : [id];
}

export function splitPane(layout: PaneLayout, id: PaneId): PaneLayout {
  return layout.includes(id) ? closePane(layout, id) : [...layout, id];
}

export function dropPane(layout: PaneLayout, id: PaneId, index: number): PaneLayout {
  const before = layout.slice(0, index).filter((pane) => pane !== id);
  const after = layout.slice(index).filter((pane) => pane !== id);
  return [...before, id, ...after];
}

export function showPane(layout: PaneLayout, id: PaneId): PaneLayout {
  return layout.includes(id) ? layout : [id];
}

export type PanelSide = "left" | "right";
export type SideLayouts = Record<PanelSide, PaneLayout>;

export const PANE_SIDES: Record<PaneId, PanelSide> = {
  chat: "left",
  chats: "left",
  context: "left",
  about: "right",
  step: "right",
  path: "right",
  hotspots: "right",
  notes: "right",
  outline: "right",
};

export function onPaneSide(
  layouts: SideLayouts,
  id: PaneId,
  change: (layout: PaneLayout, id: PaneId) => PaneLayout,
): SideLayouts {
  const side = PANE_SIDES[id];
  return { ...layouts, [side]: change(layouts[side], id) };
}

export function withOnlySide(layouts: SideLayouts, side: PanelSide): SideLayouts {
  const otherSide: PanelSide = side === "left" ? "right" : "left";
  return { ...layouts, [otherSide]: [] };
}

export function openPaneOnSide(
  layouts: SideLayouts,
  id: PaneId,
  change: (layout: PaneLayout, id: PaneId) => PaneLayout,
  wideScreen: boolean,
): SideLayouts {
  const next = onPaneSide(layouts, id, change);
  const side = PANE_SIDES[id];
  const opened = next[side].includes(id);
  return !wideScreen && opened ? withOnlySide(next, side) : next;
}
