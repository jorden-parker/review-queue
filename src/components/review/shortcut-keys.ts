export type ShortcutAction =
  | "next-hunk"
  | "previous-hunk"
  | "next-step"
  | "previous-step"
  | "done-and-next"
  | "peek-definition"
  | "peek-references"
  | "back"
  | "note"
  | "park"
  | "toggle-all"
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
  c: "note",
  P: "park",
  a: "toggle-all",
  ".": "pause",
  Escape: "close",
  "?": "help",
};

const CHORDS: Record<string, Record<string, ShortcutAction>> = {
  g: { d: "peek-definition", r: "peek-references" },
};

export function resolveShortcut(
  previousKey: string | null,
  key: string,
): ShortcutAction | "pending" | null {
  if (previousKey && CHORDS[previousKey]) return CHORDS[previousKey][key] ?? null;
  if (CHORDS[key]) return "pending";
  return SINGLE_KEYS[key] ?? null;
}
