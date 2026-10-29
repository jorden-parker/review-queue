"use client";

import { MessageSquarePlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { AssistAction } from "@/lib/assist-protocol";
import { ASSIST_ACTION_BUTTONS } from "./assist-actions";
import type { LineSelection } from "./use-line-selection";

export function SelectionToolbar({
  selection,
  aiEnabled,
  onNote,
  onAction,
}: {
  selection: LineSelection;
  aiEnabled: boolean;
  onNote: (() => void) | null;
  onAction: (action: AssistAction) => void;
}) {
  if (!aiEnabled && !onNote) return null;
  return (
    <div
      role="toolbar"
      aria-label="Work with the selected lines"
      style={{ top: selection.top, left: selection.left }}
      className="fixed z-30 flex animate-step-enter items-center gap-1 rounded-lg border bg-popover p-1 shadow-md"
      onMouseDown={(event) => event.preventDefault()}
    >
      {onNote && (
        <Button variant="ghost" size="xs" onClick={onNote}>
          <MessageSquarePlus /> Note
        </Button>
      )}
      {aiEnabled &&
        ASSIST_ACTION_BUTTONS.map(({ action, label, icon }) => (
          <Button key={action} variant="ghost" size="xs" onClick={() => onAction(action)}>
            {icon} {label}
          </Button>
        ))}
    </div>
  );
}
