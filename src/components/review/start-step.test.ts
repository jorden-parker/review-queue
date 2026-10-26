import { describe, expect, it } from "vitest";
import { reviewPayload } from "@/test/review-fixture";
import { suggestedStartStepId } from "./start-step";
import type { OrientationState } from "./use-review";

const STEPS = reviewPayload().steps;
const HEURISTIC_START = STEPS[0].id;
const SUGGESTED_START = STEPS[1].id;

function readyWithStart(startStepId: string): OrientationState {
  return {
    status: "ready",
    orientation: {
      model: "m",
      summary: "",
      intent: "",
      risk: "low",
      startStepId,
      startReason: "",
      hotspotNotes: [],
      extraHotspots: [],
    },
  };
}

describe("suggestedStartStepId", () => {
  it("falls back to the heuristic start while loading", () => {
    expect(suggestedStartStepId(STEPS, HEURISTIC_START, { status: "loading" })).toBe(
      HEURISTIC_START,
    );
  });

  it("uses the model's start step when it is one of the steps", () => {
    expect(suggestedStartStepId(STEPS, HEURISTIC_START, readyWithStart(SUGGESTED_START))).toBe(
      SUGGESTED_START,
    );
  });

  it("falls back to the heuristic start when the model names an unknown step", () => {
    expect(suggestedStartStepId(STEPS, HEURISTIC_START, readyWithStart("nope"))).toBe(
      HEURISTIC_START,
    );
    expect(suggestedStartStepId(STEPS, HEURISTIC_START, readyWithStart(""))).toBe(HEURISTIC_START);
  });

  it("falls back to the heuristic start when the orientation failed", () => {
    expect(
      suggestedStartStepId(STEPS, HEURISTIC_START, {
        status: "error",
        message: "connection refused",
      }),
    ).toBe(HEURISTIC_START);
  });
});
