import type { FileDiff, Hotspot, Severity } from "@/lib/types";
import { FILE_RULES, missingTests, type HotspotContext } from "./rules";

const SEVERITY_ORDER: Record<Severity, number> = { high: 0, medium: 1, low: 2 };

export function findHotspots(diffs: FileDiff[], context: Omit<HotspotContext, "diffs">): Hotspot[] {
  const full: HotspotContext = { ...context, diffs };
  const found = [
    ...diffs.flatMap((file) => FILE_RULES.flatMap((rule) => rule(file, full))),
    ...missingTests(diffs),
  ];
  return found.sort(
    (a, b) =>
      SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity] ||
      a.path.localeCompare(b.path) ||
      (a.line ?? 0) - (b.line ?? 0),
  );
}
