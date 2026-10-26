"use client";

import { CornerUpLeft } from "lucide-react";
import type { Jump } from "@/lib/session/store";

type JumpTrailProps = { jumps: Jump[]; onBack: () => void; onClear: () => void };

export function JumpTrail({ jumps, onBack, onClear }: JumpTrailProps) {
  if (jumps.length === 0) return null;
  const origin = jumps[0];
  return (
    <div className="flex items-center gap-3 rounded-lg bg-focus px-3 py-1 text-sm">
      <span>
        {jumps.length} {jumps.length === 1 ? "jump" : "jumps"} deep from{" "}
        <span className="font-mono">
          {origin.path}:{origin.line}
        </span>
        <span className="text-muted"> · {jumps.map((jump) => jump.name).join(" → ")}</span>
      </span>
      <button onClick={onBack} className="flex items-center gap-1 font-bold">
        <CornerUpLeft size={14} /> Back (b)
      </button>
      <button onClick={onClear} className="text-muted">
        Forget trail
      </button>
    </div>
  );
}
