"use client";

import { CheckSquare, Sparkles, Square } from "lucide-react";
import type { Hotspot, Severity } from "@/lib/types";

export type DisplayHotspot = Hotspot & { note?: string; suggested?: boolean };

type HotspotListProps = {
  hotspots: DisplayHotspot[];
  checked: string[];
  onOpen: (hotspot: DisplayHotspot) => void;
  onToggleChecked: (id: string) => void;
};

const SEVERITY_STYLES: Record<Severity, string> = {
  high: "bg-high",
  medium: "bg-medium",
  low: "bg-low",
};

export function HotspotList({ hotspots, checked, onOpen, onToggleChecked }: HotspotListProps) {
  if (hotspots.length === 0) {
    return <p className="text-sm text-muted">Nothing unusual spotted. Still read carefully.</p>;
  }
  const remaining = hotspots.filter((hotspot) => !checked.includes(hotspot.id)).length;
  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm text-muted">
        {remaining} still to look at. Tick them off as you check.
      </p>
      <ul className="flex flex-col gap-1">
        {hotspots.map((hotspot) => {
          const isChecked = checked.includes(hotspot.id);
          return (
            <li
              key={hotspot.id}
              className={`flex gap-2 rounded-lg p-2 hover:bg-sunken ${isChecked ? "opacity-50" : ""}`}
            >
              <button
                onClick={() => onToggleChecked(hotspot.id)}
                className="mt-0.5 shrink-0"
                title="Checked"
              >
                {isChecked ? <CheckSquare size={16} /> : <Square size={16} />}
              </button>
              <button onClick={() => onOpen(hotspot)} className="flex flex-1 flex-col text-left">
                <span className="flex items-center gap-2 text-sm font-bold">
                  <span
                    className={`size-2 shrink-0 rounded-full ${SEVERITY_STYLES[hotspot.severity]}`}
                  />
                  {hotspot.title}
                  {hotspot.suggested && <Sparkles size={12} className="text-accent" />}
                </span>
                <span className="font-mono text-xs text-muted">
                  {hotspot.path}
                  {hotspot.line ? `:${hotspot.line}` : ""}
                </span>
                <span className="text-xs">{hotspot.note ?? hotspot.why}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
