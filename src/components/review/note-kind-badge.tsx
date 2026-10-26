import { Badge } from "@/components/ui/badge";
import type { NoteKind } from "@/lib/types";
import { NOTE_KIND_LABELS, NOTE_KIND_STYLES } from "./note-kinds";

export function NoteKindBadge({ kind }: { kind: NoteKind }) {
  return <Badge className={NOTE_KIND_STYLES[kind]}>{NOTE_KIND_LABELS[kind]}</Badge>;
}
