"use client";

import { CornerUpLeft, X } from "lucide-react";
import { HintButton } from "@/components/common/hint-button";
import type { Jump } from "@/lib/session/store";

type JumpTrailProps = { jumps: Jump[]; onBack: () => void; onClear: () => void };

export function JumpTrail({ jumps, onBack, onClear }: JumpTrailProps) {
  const last = jumps.at(-1);
  if (!last) return null;
  return (
    <div
      role="status"
      className="pointer-events-auto flex animate-step-enter items-center gap-1 rounded-full border bg-popover px-1 py-1 text-xs text-popover-foreground shadow-md"
    >
      <HintButton
        variant="ghost"
        size="xs"
        hint={`${last.path}:${last.line}`}
        shortcut="b"
        onClick={onBack}
      >
        <CornerUpLeft /> Back to <span className="font-mono">{last.name}</span>
      </HintButton>
      <HintButton
        variant="ghost"
        size="icon-xs"
        hint="Forget trail"
        aria-label="Forget trail"
        onClick={onClear}
      >
        <X />
      </HintButton>
    </div>
  );
}
