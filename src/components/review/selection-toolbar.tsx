"use client";

import { BookOpen, MessageSquareText, Sparkles, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { AssistAction } from "@/lib/assist-protocol";
import type { LineSelection } from "./use-line-selection";

const ACTIONS: { action: AssistAction; label: string; icon: React.ReactNode }[] = [
  { action: "explain", label: "Explain", icon: <BookOpen /> },
  { action: "simplify", label: "Simplify", icon: <Wand2 /> },
  { action: "comment", label: "Comment", icon: <MessageSquareText /> },
  { action: "ask", label: "Ask", icon: <Sparkles /> },
];

export function SelectionToolbar({
  selection,
  onAction,
}: {
  selection: LineSelection;
  onAction: (action: AssistAction) => void;
}) {
  return (
    <div
      role="toolbar"
      aria-label="Ask the model about the selected lines"
      style={{ top: selection.top, left: selection.left }}
      className="fixed z-30 flex animate-step-enter gap-1 rounded-lg border bg-popover p-1 shadow-md"
      onMouseDown={(event) => event.preventDefault()}
    >
      {ACTIONS.map(({ action, label, icon }) => (
        <Button key={action} variant="ghost" size="xs" onClick={() => onAction(action)}>
          {icon} {label}
        </Button>
      ))}
    </div>
  );
}
