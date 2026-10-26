import { describe, expect, it } from "vitest";
import { toolbarTop } from "./toolbar-position";

describe("toolbarTop", () => {
  it("sits just below the selection when there is room", () => {
    expect(toolbarTop({ top: 100, bottom: 200 }, 800)).toBe(206);
  });

  it("moves above the selection near the bottom of the window", () => {
    expect(toolbarTop({ top: 600, bottom: 790 }, 800)).toBe(554);
  });

  it("pins to the bottom edge when the selection fills the window", () => {
    expect(toolbarTop({ top: 10, bottom: 900 }, 800)).toBe(752);
  });
});
