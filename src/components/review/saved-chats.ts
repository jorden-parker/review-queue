import type { AssistThread } from "@/lib/assist-protocol";
import type { Session } from "@/lib/session/store";

export function withoutSavedChat(session: Session, id: string): Session {
  return { ...session, assistThreads: session.assistThreads.filter((chat) => chat.id !== id) };
}

export function withSavedChat(session: Session, thread: AssistThread, updatedAt: string): Session {
  const rest = withoutSavedChat(session, thread.id).assistThreads;
  return { ...session, assistThreads: [{ ...thread, updatedAt }, ...rest] };
}
