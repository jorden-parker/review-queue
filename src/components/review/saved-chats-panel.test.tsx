import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { SavedAssistThread } from "@/lib/assist-protocol";
import { SavedChatsPanel } from "./saved-chats-panel";

const HEAD = "a".repeat(40);

function chat(overrides: Partial<SavedAssistThread>): SavedAssistThread {
  return {
    id: "t1",
    headSha: HEAD,
    target: { kind: "file", path: "src/a.ts" },
    action: "explain",
    question: null,
    turns: [
      { role: "reviewer", text: "Explain this file" },
      { role: "model", text: "It loads the config." },
    ],
    updatedAt: "2026-10-26T10:00:00.000Z",
    ...overrides,
  };
}

function renderPanel(chats: SavedAssistThread[]) {
  const handlers = { onOpen: vi.fn(), onDelete: vi.fn() };
  render(
    <SavedChatsPanel
      chats={chats}
      headSha={HEAD}
      labelOf={(saved) => `${saved.target.kind === "file" ? saved.target.path : "lines"} label`}
      {...handlers}
    />,
  );
  return handlers;
}

describe("SavedChatsPanel", () => {
  it("explains how to start a chat when there are none", () => {
    renderPanel([]);
    expect(screen.getByText(/select lines or use a file’s “actions”/i)).toBeTruthy();
  });

  it("lists each chat with what was asked and where", () => {
    renderPanel([chat({}), chat({ id: "t2", action: "ask", question: "Why retry?" })]);
    expect(screen.getByText("Explain this file")).toBeTruthy();
    expect(screen.getByText("Why retry?")).toBeTruthy();
    expect(screen.getAllByText("src/a.ts label")).toHaveLength(2);
  });

  it("titles a step-check chat with the opener it was started from", () => {
    const check = { kind: "check" as const, stepId: "s", check: 0, path: "src/a.ts" };
    renderPanel([
      chat({
        target: check,
        turns: [
          { role: "reviewer", text: "Tell me more: Is the key stable?" },
          { role: "model", text: "It is." },
        ],
      }),
    ]);
    expect(screen.getByText("Tell me more: Is the key stable?")).toBeTruthy();
    expect(screen.getByText("lines label")).toBeTruthy();
  });

  it("marks chats asked on an older commit", () => {
    renderPanel([chat({ headSha: "b".repeat(40) })]);
    expect(screen.getByText("Older commit")).toBeTruthy();
  });

  it("reopens and deletes a chat", async () => {
    const saved = chat({});
    const handlers = renderPanel([saved]);
    await userEvent.click(screen.getByRole("button", { name: /explain this file/i }));
    expect(handlers.onOpen).toHaveBeenCalledWith(saved);
    await userEvent.click(screen.getByRole("button", { name: "Delete chat" }));
    expect(handlers.onDelete).toHaveBeenCalledWith("t1");
  });
});
