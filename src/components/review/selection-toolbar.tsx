"use client";

import { Button } from "@/components/ui/button";
import type { AssistAction } from "@/lib/assist-protocol";
import { ASSIST_ACTION_BUTTONS } from "./assist-actions";
import type { LineSelection } from "./use-line-selection";

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
      className="fixed z-30 flex animate-step-enter items-center gap-1 rounded-lg border bg-popover p-1 shadow-md"
      onMouseDown={(event) => event.preventDefault()}
    >
      {ASSIST_ACTION_BUTTONS.map(({ action, label, icon }) => (
        <Button key={action} variant="ghost" size="xs" onClick={() => onAction(action)}>
          {icon} {label}
        </Button>
      ))}
    </div>
  );
}
