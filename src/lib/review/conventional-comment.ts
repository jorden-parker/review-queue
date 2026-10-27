import { NOTE_DECORATIONS, type NoteDecoration, type NoteTag } from "@/lib/types";

const CONFLICTING_DECORATION: Partial<Record<NoteDecoration, NoteDecoration>> = {
  blocking: "non-blocking",
  "non-blocking": "blocking",
};

export function conventionalLabel(tag: NoteTag): string {
  const label = tag.kind === "parked" ? "aside" : tag.kind;
  return tag.decorations.length > 0 ? `${label} (${tag.decorations.join(",")})` : label;
}

export function isBlocking(tag: NoteTag): boolean {
  return tag.decorations.includes("blocking");
}

export function exclusiveDecorations(
  previous: NoteDecoration[],
  next: NoteDecoration[],
): NoteDecoration[] {
  const added = next.filter((decoration) => !previous.includes(decoration));
  const dropped = added.map((decoration) => CONFLICTING_DECORATION[decoration]).find(Boolean);
  const kept = next.filter((decoration) => decoration !== dropped);
  return NOTE_DECORATIONS.filter((decoration) => kept.includes(decoration));
}

export function hasConsistentDecorations(decorations: NoteDecoration[]): boolean {
  const hasBothBlocking = decorations.includes("blocking") && decorations.includes("non-blocking");
  const hasDuplicate = new Set(decorations).size !== decorations.length;
  return !hasBothBlocking && !hasDuplicate;
}
