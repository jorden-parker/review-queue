import type { Step } from "@/lib/types";
import type { OrientationState } from "./use-review";

export function suggestedStartStepId(
  steps: Step[],
  heuristicStartId: string | null,
  orientation: OrientationState,
): string | null {
  if (orientation.status !== "ready") return heuristicStartId;
  const suggested = orientation.orientation.startStepId;
  return steps.some((step) => step.id === suggested) ? suggested : heuristicStartId;
}
