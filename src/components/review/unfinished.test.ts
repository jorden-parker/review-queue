import { describe, expect, it } from "vitest";
import { unfinishedMessage } from "./unfinished";

describe("unfinishedMessage", () => {
  it("mentions only what is left, with the right plurals", () => {
    expect(unfinishedMessage(3, 0)).toBe("Heads up: 3 steps are not ticked off yet.");
    expect(unfinishedMessage(0, 1)).toBe("Heads up: 1 hotspot is not ticked off yet.");
    expect(unfinishedMessage(1, 2)).toBe("Heads up: 1 step and 2 hotspots are not ticked off yet.");
    expect(unfinishedMessage(0, 0)).toBeNull();
  });
});
