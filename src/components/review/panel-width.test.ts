import { describe, expect, it } from "vitest";
import {
  PANEL_WIDTH,
  clampPanelWidth,
  fittedPanelWidth,
  maxPanelWidth,
  nextWidthOnDoubleClick,
  widthAfterKey,
} from "./panel-width";

const VIEWPORT = 1600;

describe("maxPanelWidth", () => {
  it("leaves room for the diff", () => {
    expect(maxPanelWidth(VIEWPORT)).toBe(VIEWPORT - 320);
  });

  it("never drops below the minimum on a narrow window", () => {
    expect(maxPanelWidth(600)).toBe(PANEL_WIDTH.min);
  });
});

describe("clampPanelWidth", () => {
  it("keeps widths inside the allowed range", () => {
    expect(clampPanelWidth(100, VIEWPORT)).toBe(PANEL_WIDTH.min);
    expect(clampPanelWidth(5000, VIEWPORT)).toBe(maxPanelWidth(VIEWPORT));
    expect(clampPanelWidth(500, VIEWPORT)).toBe(500);
  });

  it("rounds to whole pixels", () => {
    expect(clampPanelWidth(500.6, VIEWPORT)).toBe(501);
  });
});

describe("fittedPanelWidth", () => {
  it("grows by the widest overflow", () => {
    expect(fittedPanelWidth(400, [20, 180, 0], VIEWPORT)).toBe(580);
  });

  it("stays put when nothing overflows", () => {
    expect(fittedPanelWidth(400, [], VIEWPORT)).toBe(400);
  });

  it("stops at the maximum", () => {
    expect(fittedPanelWidth(400, [4000], VIEWPORT)).toBe(maxPanelWidth(VIEWPORT));
  });
});

describe("nextWidthOnDoubleClick", () => {
  it("fits the content when it overflows", () => {
    expect(nextWidthOnDoubleClick(400, 700, VIEWPORT)).toBe(700);
  });

  it("returns to the default when the content already fits", () => {
    expect(nextWidthOnDoubleClick(700, 700, VIEWPORT)).toBe(PANEL_WIDTH.default);
  });

  it("returns to the default when the panel is wider than its content", () => {
    expect(nextWidthOnDoubleClick(900, 900, VIEWPORT)).toBe(PANEL_WIDTH.default);
  });
});

describe("widthAfterKey", () => {
  it("widens with the left arrow and narrows with the right arrow", () => {
    expect(widthAfterKey(400, "ArrowLeft", false, VIEWPORT)).toBe(416);
    expect(widthAfterKey(400, "ArrowRight", false, VIEWPORT)).toBe(384);
  });

  it("takes bigger steps with shift", () => {
    expect(widthAfterKey(400, "ArrowLeft", true, VIEWPORT)).toBe(464);
  });

  it("jumps to the ends with Home and End", () => {
    expect(widthAfterKey(400, "Home", false, VIEWPORT)).toBe(PANEL_WIDTH.min);
    expect(widthAfterKey(400, "End", false, VIEWPORT)).toBe(maxPanelWidth(VIEWPORT));
  });

  it("ignores other keys", () => {
    expect(widthAfterKey(400, "a", false, VIEWPORT)).toBeNull();
  });
});
