"use client";

import { Sparkles, X } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import type { AssistAction } from "@/lib/assist-protocol";
import { ASSIST_ACTION_BUTTONS } from "./assist-actions";

export function FileAskButton({ onAsk }: { onAsk: (action: AssistAction) => void }) {
  const [choosing, setChoosing] = useState(false);
  if (!choosing) {
    return (
      <Button variant="ghost" size="xs" onClick={() => setChoosing(true)}>
        <Sparkles /> Ask about file
      </Button>
    );
  }
  const ask = (action: AssistAction) => {
    setChoosing(false);
    onAsk(action);
  };
  return (
    <div
      role="toolbar"
      aria-label="Ask the model about this file"
      className="flex items-center gap-1"
    >
      {ASSIST_ACTION_BUTTONS.map(({ action, label, icon }) => (
        <Button key={action} variant="ghost" size="xs" onClick={() => ask(action)}>
          {icon} {label}
        </Button>
      ))}
      <Button variant="ghost" size="icon-xs" aria-label="Cancel" onClick={() => setChoosing(false)}>
        <X />
      </Button>
    </div>
  );
}
