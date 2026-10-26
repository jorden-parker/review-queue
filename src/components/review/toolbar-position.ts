const GAP_PX = 6;
const TOOLBAR_HEIGHT_PX = 40;
const EDGE_PX = 8;

export function toolbarTop(box: { top: number; bottom: number }, viewportHeight: number): number {
  const below = box.bottom + GAP_PX;
  if (below + TOOLBAR_HEIGHT_PX <= viewportHeight - EDGE_PX) return below;
  const above = box.top - GAP_PX - TOOLBAR_HEIGHT_PX;
  if (above >= EDGE_PX) return above;
  return viewportHeight - TOOLBAR_HEIGHT_PX - EDGE_PX;
}
