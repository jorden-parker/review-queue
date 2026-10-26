import { describe, expect, it } from "vitest";
import type { Hotspot } from "@/lib/types";
import { displayHotspots } from "./display-hotspots";

const HOTSPOT: Hotspot = {
  id: "h1",
  rule: "todo",
  severity: "low",
  path: "a.ts",
  line: 1,
  title: "TODO",
  why: "w",
};

describe("displayHotspots", () => {
  it("passes heuristics through until the model is ready", () => {
    expect(displayHotspots([HOTSPOT], { status: "loading" })).toEqual([HOTSPOT]);
  });

  it("adds model notes and suggested hotspots", () => {
    const result = displayHotspots([HOTSPOT], {
      status: "ready",
      orientation: {
        model: "m",
        summary: "",
        intent: "",
        risk: "low",
        startStepId: "",
        startReason: "",
        hotspotNotes: [{ id: "h1", note: "Track it" }],
        extraHotspots: [{ path: "a.ts", line: 9, title: "Odd loop", why: "Never ends?" }],
      },
    });
    expect(result[0].note).toBe("Track it");
    expect(result[1]).toMatchObject({ suggested: true, path: "a.ts", line: 9, title: "Odd loop" });
  });
});
