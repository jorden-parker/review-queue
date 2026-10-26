import { describe, expect, it } from "vitest";
import type { AssistThread } from "@/lib/assist-protocol";
import { emptySession, HEAD_SHA } from "@/test/review-fixture";
import { withoutSavedChat, withSavedChat } from "./saved-chats";

function thread(id: string, text = "It loads."): AssistThread {
  return {
    id,
    headSha: HEAD_SHA,
    target: { kind: "file", path: "src/a.ts" },
    action: "explain",
    question: null,
    turns: [
      { role: "reviewer", text: "Explain this file" },
      { role: "model", text },
    ],
  };
}

const NOW = "2026-10-26T10:00:00.000Z";

describe("withSavedChat", () => {
  it("puts a new chat first", () => {
    const session = withSavedChat(emptySession(), thread("t1"), NOW);
    const next = withSavedChat(session, thread("t2"), NOW);
    expect(next.assistThreads.map((chat) => chat.id)).toEqual(["t2", "t1"]);
    expect(next.assistThreads[0].updatedAt).toBe(NOW);
  });

  it("replaces an earlier save of the same chat and moves it first", () => {
    let session = withSavedChat(emptySession(), thread("t1"), NOW);
    session = withSavedChat(session, thread("t2"), NOW);
    session = withSavedChat(session, thread("t1", "It loads twice."), NOW);
    expect(session.assistThreads.map((chat) => chat.id)).toEqual(["t1", "t2"]);
    expect(session.assistThreads[0].turns[1].text).toBe("It loads twice.");
  });
});

describe("withoutSavedChat", () => {
  it("drops the chat", () => {
    const session = withSavedChat(emptySession(), thread("t1"), NOW);
    expect(withoutSavedChat(session, "t1").assistThreads).toEqual([]);
  });
});
