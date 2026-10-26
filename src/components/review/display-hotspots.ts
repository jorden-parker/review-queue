import type { Hotspot } from "@/lib/types";
import type { DisplayHotspot } from "./hotspot-list";
import type { OrientationState } from "./use-review";

export function displayHotspots(
  hotspots: Hotspot[],
  orientation: OrientationState,
): DisplayHotspot[] {
  if (orientation.status !== "ready") return hotspots;
  const notes = new Map(orientation.orientation.hotspotNotes.map((note) => [note.id, note.note]));
  const suggested: DisplayHotspot[] = orientation.orientation.extraHotspots.map((hotspot) => ({
    id: `ai:${hotspot.path}:${hotspot.line ?? 0}:${hotspot.title}`,
    rule: "ai",
    severity: "medium",
    path: hotspot.path,
    line: hotspot.line ?? null,
    title: hotspot.title,
    why: hotspot.why,
    suggested: true,
  }));
  return [
    ...hotspots.map((hotspot) => ({ ...hotspot, note: notes.get(hotspot.id) })),
    ...suggested,
  ];
}
