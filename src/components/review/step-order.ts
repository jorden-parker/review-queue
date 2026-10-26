import type { Step } from "@/lib/types";
import type { OrientationState } from "./use-review";

export function orderedSteps(steps: Step[], orientation: OrientationState): Step[] {
  if (orientation.status === "loading") return [];
  if (orientation.status !== "ready") return steps;
  const order = orientation.orientation.stepOrder.map((entry) => entry.id);
  const rank = (step: Step) => {
    const index = order.indexOf(step.id);
    return index === -1 ? order.length : index;
  };
  return [...steps].sort((a, b) => rank(a) - rank(b));
}

export function stepReasons(orientation: OrientationState): Record<string, string> {
  if (orientation.status !== "ready") return {};
  const reasoned = orientation.orientation.stepOrder.filter((entry) => entry.why);
  return Object.fromEntries(reasoned.map((entry) => [entry.id, entry.why]));
}
