import { cn } from "cn";
import { Badge } from "@/components/ui/badge";
import { isBlocking } from "@/lib/review/conventional-comment";
import type { NoteTag } from "@/lib/types";
import { NOTE_KIND_LABELS, NOTE_KIND_STYLES } from "./note-kinds";

function badgeText(tag: NoteTag): string {
  const label = NOTE_KIND_LABELS[tag.kind];
  return tag.decorations.length > 0 ? `${label} (${tag.decorations.join(", ")})` : label;
}

export function NoteKindBadge({ tag }: { tag: NoteTag }) {
  const style = isBlocking(tag) ? NOTE_KIND_STYLES.issue : NOTE_KIND_STYLES[tag.kind];
  return (
    <Badge className={cn(style, "h-auto whitespace-normal wrap-anywhere")}>{badgeText(tag)}</Badge>
  );
}
