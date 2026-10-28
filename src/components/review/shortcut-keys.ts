export type ShortcutAction =
  | "next-hunk"
  | "previous-hunk"
  | "next-step"
  | "previous-step"
  | "done-and-next"
  | "peek-definition"
  | "peek-references"
  | "pin-symbol"
  | "open-context"
  | "open-outline"
  | "open-files"
  | "open-map"
  | "back"
  | "note"
  | "ask-model"
  | "park"
  | "toggle-all"
  | "toggle-panel"
  | "toggle-left-panel"
  | "toggle-right-panel"
  | "pause"
  | "close"
  | "help";

const SINGLE_KEYS: Record<string, ShortcutAction> = {
  j: "next-hunk",
  k: "previous-hunk",
  n: "next-step",
  p: "previous-step",
  x: "done-and-next",
  b: "back",
  m: "pin-symbol",
  c: "note",
  i: "ask-model",
  P: "park",
  a: "toggle-all",
  "[": "toggle-left-panel",
  "]": "toggle-right-panel",
  "\\": "toggle-panel",
  ".": "pause",
  Escape: "close",
  "?": "help",
};

const CHORDS: Record<string, Record<string, ShortcutAction>> = {
  g: {
    d: "peek-definition",
    r: "peek-references",
    c: "open-context",
    o: "open-outline",
    f: "open-files",
    m: "open-map",
  },
};

export function resolveShortcut(
  previousKey: string | null,
  key: string,
): ShortcutAction | "pending" | null {
  if (previousKey && CHORDS[previousKey]) return CHORDS[previousKey][key] ?? null;
  if (CHORDS[key]) return "pending";
  return SINGLE_KEYS[key] ?? null;
}
