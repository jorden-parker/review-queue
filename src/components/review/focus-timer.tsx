"use client";

import { Pause, Play, Timer } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { cn } from "cn";
import { Button } from "@/components/ui/button";

const FOCUS_SECONDS = 25 * 60;

function clock(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  return `${minutes}:${String(seconds % 60).padStart(2, "0")}`;
}

export function useFocusTimer(onFinished: () => void) {
  const [remaining, setRemaining] = useState(FOCUS_SECONDS);
  const [running, setRunning] = useState(false);
  const endsAt = useRef(0);

  function toggle() {
    if (!running) endsAt.current = Date.now() + remaining * 1000;
    setRunning(!running);
  }

  useEffect(() => {
    if (!running) return;
    const timer = setInterval(() => {
      const left = Math.max(0, Math.round((endsAt.current - Date.now()) / 1000));
      setRemaining(left > 0 ? left : FOCUS_SECONDS);
      if (left > 0) return;
      setRunning(false);
      onFinished();
    }, 1000);
    return () => clearInterval(timer);
  }, [running, onFinished]);

  return { remaining, running, toggle };
}

export function FocusTimerButton({ timer }: { timer: ReturnType<typeof useFocusTimer> }) {
  const { remaining, running, toggle } = timer;
  return (
    <Button
      variant="ghost"
      aria-pressed={running}
      onClick={toggle}
      className={cn("justify-start tabular-nums", running && "bg-accent text-accent-foreground")}
    >
      {running ? <Pause /> : remaining === FOCUS_SECONDS ? <Timer /> : <Play />}
      Focus timer
      <span className="ml-auto">{clock(remaining)}</span>
    </Button>
  );
}
