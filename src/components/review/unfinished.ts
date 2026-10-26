import { plural } from "@/lib/plural";

export function unfinishedMessage(stepsLeft: number, hotspotsLeft: number): string | null {
  const parts = [
    stepsLeft > 0 ? plural(stepsLeft, "step") : null,
    hotspotsLeft > 0 ? plural(hotspotsLeft, "hotspot") : null,
  ].filter((part) => part !== null);
  if (parts.length === 0) return null;
  const verb = stepsLeft + hotspotsLeft === 1 ? "is" : "are";
  return `Heads up: ${parts.join(" and ")} ${verb} not ticked off yet.`;
}
