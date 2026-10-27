import { describe, expect, it } from "vitest";
import {
  PANEL_WIDTH,
  clampPanelWidth,
  dragDelta,
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

  it("leaves room for the other side's panel too", () => {
    expect(maxPanelWidth(1600, 400)).toBe(880);
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

  it("shrinks to the room left beside the other side", () => {
    expect(clampPanelWidth(5000, 1600, 400)).toBe(880);
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

describe("dragDelta", () => {
  it("widens a right panel when the pointer moves left", () => {
    expect(dragDelta("right", 100, 50)).toBe(50);
    expect(dragDelta("right", 100, 150)).toBe(-50);
  });

  it("widens a left panel when the pointer moves right", () => {
    expect(dragDelta("left", 100, 150)).toBe(50);
    expect(dragDelta("left", 100, 50)).toBe(-50);
  });
});

describe("widthAfterKey", () => {
  it("widens a right panel with the left arrow and narrows it with the right arrow", () => {
    expect(widthAfterKey(400, "ArrowLeft", false, VIEWPORT, "right")).toBe(416);
    expect(widthAfterKey(400, "ArrowRight", false, VIEWPORT, "right")).toBe(384);
  });

  it("widens a left panel with the right arrow and narrows it with the left arrow", () => {
    expect(widthAfterKey(400, "ArrowRight", false, VIEWPORT, "left")).toBe(416);
    expect(widthAfterKey(400, "ArrowLeft", false, VIEWPORT, "left")).toBe(384);
  });

  it("takes bigger steps with shift", () => {
    expect(widthAfterKey(400, "ArrowLeft", true, VIEWPORT, "right")).toBe(464);
  });

  it("jumps to the ends with Home and End", () => {
    expect(widthAfterKey(400, "Home", false, VIEWPORT, "right")).toBe(PANEL_WIDTH.min);
    expect(widthAfterKey(400, "End", false, VIEWPORT, "right")).toBe(maxPanelWidth(VIEWPORT));
  });

  it("caps End at the room left beside the other side", () => {
    expect(widthAfterKey(400, "End", false, 1600, "left", 400)).toBe(880);
  });

  it("ignores other keys", () => {
    expect(widthAfterKey(400, "a", false, VIEWPORT, "right")).toBeNull();
  });
});
