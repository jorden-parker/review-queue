import type { Step } from "@/lib/types";
import type { OrientationState } from "./use-review";

export function orderedSteps(steps: Step[], orientation: OrientationState): Step[] {
  if (orientation.status !== "ready") return steps;
  const order = orientation.orientation.stepOrder;
  const rank = (step: Step) => {
    const index = order.indexOf(step.id);
    return index === -1 ? order.length : index;
  };
  return [...steps].sort((a, b) => rank(a) - rank(b));
}
