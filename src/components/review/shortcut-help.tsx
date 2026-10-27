"use client";

import { AppDialog } from "@/components/common/app-dialog";
import { Kbd, KbdGroup } from "@/components/ui/kbd";

const SHORTCUTS: [string[], string][] = [
  [["j", "k"], "Next / previous chunk"],
  [["n", "p"], "Next / previous step"],
  [["x"], "Mark step done and move on"],
  [["g", "d"], "Definition of the hovered name"],
  [["g", "r"], "References to the hovered name"],
  [["m"], "Pin or unpin the peeked name"],
  [["g", "c"], "Context: names you have peeked"],
  [["g", "o"], "Outline of this step's files"],
  [["b"], "Back from a jump"],
  [["c"], "Note on the current chunk"],
  [["i"], "Explain the selected lines"],
  [["P"], "Park a thought for later"],
  [["a"], "Show the whole PR or just this step"],
  [["["], "Hide or show the chat side"],
  [["]"], "Hide or show the navigation side"],
  [["\\"], "Hide or show both sides"],
  [["Shift", "click"], "Split a panel icon into its own pane (or drag it)"],
  [["."], "Pause and leave yourself a note"],
  [["Esc"], "Close panels"],
  [["?"], "This help"],
];

export function ShortcutHelp({ onClose }: { onClose: () => void }) {
  return (
    <AppDialog title="Keyboard" onClose={onClose} className="sm:max-w-sm">
      <dl className="grid grid-cols-keys items-center gap-x-4 gap-y-2 text-sm">
        {SHORTCUTS.map(([keys, description]) => (
          <div key={description} className="contents">
            <dt>
              <KbdGroup>
                {keys.map((key) => (
                  <Kbd key={key}>{key}</Kbd>
                ))}
              </KbdGroup>
            </dt>
            <dd className="text-muted-foreground">{description}</dd>
          </div>
        ))}
      </dl>
    </AppDialog>
  );
}
