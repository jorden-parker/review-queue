export type PaneId =
  "step" | "path" | "hotspots" | "notes" | "chat" | "chats" | "context" | "outline";
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
