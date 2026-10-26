"use client";

import { CornerUpLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Jump } from "@/lib/session/store";

type JumpTrailProps = { jumps: Jump[]; onBack: () => void; onClear: () => void };

export function JumpTrail({ jumps, onBack, onClear }: JumpTrailProps) {
  if (jumps.length === 0) return null;
  const origin = jumps[0];
  return (
    <div className="flex animate-step-enter items-center gap-2 rounded-full bg-callout py-0.5 pr-1 pl-3 text-xs text-callout-foreground">
      <span>
        {jumps.length} {jumps.length === 1 ? "jump" : "jumps"} deep from{" "}
        <span className="font-mono">
          {origin.path}:{origin.line}
        </span>
        <span className="opacity-70"> · {jumps.map((jump) => jump.name).join(" → ")}</span>
      </span>
      <Button size="xs" variant="secondary" onClick={onBack}>
        <CornerUpLeft /> Back (b)
      </Button>
      <Button size="xs" variant="ghost" onClick={onClear}>
        Forget trail
      </Button>
    </div>
  );
}
