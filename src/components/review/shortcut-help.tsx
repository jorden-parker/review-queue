"use client";

const SHORTCUTS: [string, string][] = [
  ["j / k", "Next / previous chunk"],
  ["n / p", "Next / previous step"],
  ["x", "Mark step done and move on"],
  ["g d", "Definition of the hovered name"],
  ["g r", "References to the hovered name"],
  ["b", "Back from a jump"],
  ["c", "Note on the current chunk"],
  ["P", "Park a thought for later"],
  ["a", "Show the whole PR or just this step"],
  [".", "Pause and leave yourself a note"],
  ["Esc", "Close panels"],
  ["?", "This help"],
];

export function ShortcutHelp({ onClose }: { onClose: () => void }) {
  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4"
    >
      <section className="w-full max-w-sm rounded-2xl border border-line bg-panel p-6 shadow-xl">
        <h2 className="mb-3 text-lg font-bold">Keyboard</h2>
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
          {SHORTCUTS.map(([keys, description]) => (
            <div key={keys} className="contents">
              <dt className="font-mono font-bold">{keys}</dt>
              <dd>{description}</dd>
            </div>
          ))}
        </dl>
      </section>
    </div>
  );
}
