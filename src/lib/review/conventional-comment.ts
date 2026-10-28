import {
  NOTE_DECORATIONS,
  NOTE_LABELS,
  type NoteDecoration,
  type NoteLabel,
  type NoteTag,
} from "@/lib/types";

const CONFLICTING_DECORATION: Partial<Record<NoteDecoration, NoteDecoration>> = {
  blocking: "non-blocking",
  "non-blocking": "blocking",
};

const CONVENTIONAL_PREFIX = new RegExp(
  `^\\s*(?:\\*\\*)?(${NOTE_LABELS.join("|")})(?:\\s*\\(([^)]*)\\))?(?:\\*\\*)?:(?:\\*\\*)?\\s*`,
  "i",
);

const FENCED_BLOCK = /^```[^\n`]*\n([\s\S]*?)\n?```$/;

export function unwrappedDraft(text: string): string {
  const trimmed = text.trim();
  return unwrapFence(trimmed) ?? unwrapLabelledBacktick(trimmed) ?? trimmed;
}

function unwrapFence(text: string): string | null {
  const match = FENCED_BLOCK.exec(text);
  if (!match || match[1].includes("```")) {
    return null;
  }
  const inner = match[1].trim();
  return splitConventionalPrefix(inner).tag === null ? null : inner;
}

function unwrapLabelledBacktick(text: string): string | null {
  if (
    !text.startsWith("`") ||
    text.startsWith("``") ||
    !text.endsWith("`") ||
    text.endsWith("```")
  ) {
    return null;
  }
  const inner = text.slice(1, -1).trim();
  return splitConventionalPrefix(inner).tag === null ? null : inner;
}

export function conventionalLabel(tag: NoteTag): string {
  const label = tag.kind === "parked" ? "aside" : tag.kind;
  return tag.decorations.length > 0 ? `${label} (${tag.decorations.join(",")})` : label;
}

export function splitConventionalPrefix(text: string): { tag: NoteTag | null; body: string } {
  const match = CONVENTIONAL_PREFIX.exec(text);
  if (!match) {
    return { tag: null, body: text };
  }
  const [prefix, label = "", decorationList = ""] = match;
  return {
    tag: { kind: label.toLowerCase() as NoteLabel, decorations: parseDecorations(decorationList) },
    body: text.slice(prefix.length),
  };
}

function parseDecorations(list: string): NoteDecoration[] {
  const named = list
    .split(",")
    .map((part) => part.trim().toLowerCase())
    .filter(isNoteDecoration);
  return exclusiveDecorations([], named);
}

function isNoteDecoration(value: string): value is NoteDecoration {
  return (NOTE_DECORATIONS as readonly string[]).includes(value);
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
