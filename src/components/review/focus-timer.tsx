"use client";

import { Pause, Play, Timer } from "lucide-react";
import { useEffect, useRef, useState } from "react";

const FOCUS_SECONDS = 25 * 60;

function clock(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  return `${minutes}:${String(seconds % 60).padStart(2, "0")}`;
}

export function FocusTimer({ onFinished }: { onFinished: () => void }) {
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

  return (
    <button
      onClick={toggle}
      title="25 minute focus timer"
      className={`flex items-center gap-1 rounded-lg px-2 py-1 font-mono text-sm ${running ? "bg-accent-soft text-accent" : "text-muted hover:bg-sunken"}`}
    >
      {running ? (
        <Pause size={14} />
      ) : remaining === FOCUS_SECONDS ? (
        <Timer size={14} />
      ) : (
        <Play size={14} />
      )}
      {clock(remaining)}
    </button>
  );
}
