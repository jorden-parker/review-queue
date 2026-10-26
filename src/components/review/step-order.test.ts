import { describe, expect, it } from "vitest";
import { reviewPayload } from "@/test/review-fixture";
import { orderedSteps } from "./step-order";
import type { OrientationState } from "./use-review";

const STEPS = reviewPayload().steps;
const [FIRST, SECOND, THIRD] = STEPS;

function readyWithOrder(stepOrder: string[]): OrientationState {
  return {
    status: "ready",
    orientation: {
      model: "m",
      summary: "",
      intent: "",
      risk: "low",
      stepOrder,
      startReason: "",
      hotspotNotes: [],
      extraHotspots: [],
    },
  };
}

describe("orderedSteps", () => {
  it("keeps the heuristic order while loading", () => {
    expect(orderedSteps(STEPS, { status: "loading" })).toBe(STEPS);
  });

  it("keeps the heuristic order when the model is off or failed", () => {
    expect(orderedSteps(STEPS, { status: "disabled" })).toBe(STEPS);
    expect(orderedSteps(STEPS, { status: "error", message: "connection refused" })).toBe(STEPS);
  });

  it("uses the model's order when it is ready", () => {
    const order = [THIRD.id, FIRST.id, SECOND.id];
    expect(orderedSteps(STEPS, readyWithOrder(order))).toEqual([THIRD, FIRST, SECOND]);
  });

  it("keeps every step when the model's order is incomplete or invented", () => {
    expect(orderedSteps(STEPS, readyWithOrder(["nope", SECOND.id]))).toEqual([
      SECOND,
      FIRST,
      THIRD,
    ]);
  });
});
