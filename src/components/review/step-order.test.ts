import { describe, expect, it } from "vitest";
import { reviewPayload } from "@/test/review-fixture";
import { orderedSteps, stepReasons } from "./step-order";
import type { OrientationState } from "./use-review";

const STEPS = reviewPayload().steps;
const [FIRST, SECOND, THIRD] = STEPS;

function ready(stepOrder: { id: string; why: string }[]): OrientationState {
  return {
    status: "ready",
    orientation: {
      model: "m",
      summary: "",
      intent: "",
      risk: "low",
      stepOrder,
      hotspotNotes: [],
      extraHotspots: [],
    },
  };
}

function readyWithOrder(ids: string[]): OrientationState {
  return ready(ids.map((id) => ({ id, why: `Read ${id} here.` })));
}

describe("orderedSteps", () => {
  it("holds back every step while the model is ordering them", () => {
    expect(orderedSteps(STEPS, { status: "loading" })).toEqual([]);
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

describe("stepReasons", () => {
  it("maps each step to the model's reason for its place", () => {
    expect(stepReasons(readyWithOrder([SECOND.id]))).toEqual({
      [SECOND.id]: `Read ${SECOND.id} here.`,
    });
  });

  it("leaves out steps the model gave no reason for", () => {
    expect(stepReasons(ready([{ id: FIRST.id, why: "" }]))).toEqual({});
  });

  it("has no reasons until the model is ready", () => {
    expect(stepReasons({ status: "loading" })).toEqual({});
  });
});
