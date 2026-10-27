import { describe, expect, it } from "vitest";
import {
  PANEL_STRIP_WIDTH,
  PANEL_WIDTH,
  clampPanelWidth,
  dragDelta,
  fitsBothSides,
  fittedPanelWidth,
  maxPanelWidth,
  nextWidthOnDoubleClick,
  widthAfterKey,
} from "./panel-width";

const VIEWPORT = 1600;
const ROOM_FOR_CODE_AND_STRIPS = PANEL_WIDTH.diffRoom + 2 * PANEL_STRIP_WIDTH;

describe("maxPanelWidth", () => {
  it("leaves room for the code and both icon strips", () => {
    expect(maxPanelWidth(VIEWPORT)).toBe(VIEWPORT - ROOM_FOR_CODE_AND_STRIPS);
  });

  it("never drops below the minimum on a narrow window", () => {
    expect(maxPanelWidth(600)).toBe(PANEL_WIDTH.min);
  });

  it("leaves room for the other side's panel too", () => {
    expect(maxPanelWidth(1600, 400)).toBe(576);
  });

  it("with the other side at 288, a 1280 viewport caps this side at 368", () => {
    expect(maxPanelWidth(1280, 288)).toBe(368);
  });
});

describe("fitsBothSides", () => {
  it("is false just below the width both sides need", () => {
    expect(fitsBothSides(1199)).toBe(false);
  });

  it("is true at the width both sides need", () => {
    expect(fitsBothSides(1200)).toBe(true);
  });

  it("is false at 1100, where only one side fits", () => {
    expect(fitsBothSides(1100)).toBe(false);
  });

  it("is true at 1300, where both sides fit", () => {
    expect(fitsBothSides(1300)).toBe(true);
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
    expect(clampPanelWidth(5000, 1600, 400)).toBe(576);
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
    expect(widthAfterKey(400, "End", false, 1600, "left", 400)).toBe(576);
  });

  it("ignores other keys", () => {
    expect(widthAfterKey(400, "a", false, VIEWPORT, "right")).toBeNull();
  });
});
