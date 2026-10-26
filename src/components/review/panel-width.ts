export const PANEL_WIDTH = { default: 384, min: 288, diffRoom: 320 };

const KEY_STEP = 16;
const SHIFT_KEY_STEP = 64;

export function maxPanelWidth(viewportWidth: number): number {
  return Math.max(PANEL_WIDTH.min, viewportWidth - PANEL_WIDTH.diffRoom);
}

export function clampPanelWidth(width: number, viewportWidth: number): number {
  return Math.round(Math.min(maxPanelWidth(viewportWidth), Math.max(PANEL_WIDTH.min, width)));
}

export function fittedPanelWidth(
  currentWidth: number,
  overflows: number[],
  viewportWidth: number,
): number {
  return clampPanelWidth(currentWidth + Math.max(0, ...overflows), viewportWidth);
}

export function nextWidthOnDoubleClick(
  currentWidth: number,
  fittedWidth: number,
  viewportWidth: number,
): number {
  const target = fittedWidth > currentWidth ? fittedWidth : PANEL_WIDTH.default;
  return clampPanelWidth(target, viewportWidth);
}

export function widthAfterKey(
  currentWidth: number,
  key: string,
  shift: boolean,
  viewportWidth: number,
): number | null {
  const step = shift ? SHIFT_KEY_STEP : KEY_STEP;
  const targets: Record<string, number> = {
    ArrowLeft: currentWidth + step,
    ArrowRight: currentWidth - step,
    Home: PANEL_WIDTH.min,
    End: maxPanelWidth(viewportWidth),
  };
  return key in targets ? clampPanelWidth(targets[key], viewportWidth) : null;
}
