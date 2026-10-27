import type { PanelSide } from "./pane-layout";

export const PANEL_WIDTH = { default: 384, min: 288, diffRoom: 480 };
export const PANEL_STRIP_WIDTH = 72;

const KEY_STEP = 16;
const SHIFT_KEY_STEP = 64;

export function maxPanelWidth(viewportWidth: number, reservedWidth = 0): number {
  const room = PANEL_WIDTH.diffRoom + reservedWidth + 2 * PANEL_STRIP_WIDTH;
  return Math.max(PANEL_WIDTH.min, viewportWidth - room);
}

export function fitsBothSides(viewportWidth: number): boolean {
  const bothSidesNeed = 2 * PANEL_WIDTH.min + 2 * PANEL_STRIP_WIDTH + PANEL_WIDTH.diffRoom;
  return viewportWidth >= bothSidesNeed;
}

export function clampPanelWidth(width: number, viewportWidth: number, reservedWidth = 0): number {
  const upper = maxPanelWidth(viewportWidth, reservedWidth);
  return Math.round(Math.min(upper, Math.max(PANEL_WIDTH.min, width)));
}

export function fittedPanelWidth(
  currentWidth: number,
  overflows: number[],
  viewportWidth: number,
  reservedWidth = 0,
): number {
  return clampPanelWidth(currentWidth + Math.max(0, ...overflows), viewportWidth, reservedWidth);
}

export function nextWidthOnDoubleClick(
  currentWidth: number,
  fittedWidth: number,
  viewportWidth: number,
  reservedWidth = 0,
): number {
  const target = fittedWidth > currentWidth ? fittedWidth : PANEL_WIDTH.default;
  return clampPanelWidth(target, viewportWidth, reservedWidth);
}

export function dragDelta(side: PanelSide, startX: number, currentX: number): number {
  return side === "right" ? startX - currentX : currentX - startX;
}

export function widthAfterKey(
  currentWidth: number,
  key: string,
  shift: boolean,
  viewportWidth: number,
  side: PanelSide,
  reservedWidth = 0,
): number | null {
  const step = shift ? SHIFT_KEY_STEP : KEY_STEP;
  const widenKey = side === "right" ? "ArrowLeft" : "ArrowRight";
  const narrowKey = side === "right" ? "ArrowRight" : "ArrowLeft";
  const targets: Record<string, number> = {
    [widenKey]: currentWidth + step,
    [narrowKey]: currentWidth - step,
    Home: PANEL_WIDTH.min,
    End: maxPanelWidth(viewportWidth, reservedWidth),
  };
  return key in targets ? clampPanelWidth(targets[key], viewportWidth, reservedWidth) : null;
}
