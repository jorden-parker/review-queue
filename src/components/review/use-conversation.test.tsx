import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Conversation } from "@/lib/github/conversation";
import type { PullRequestRef } from "@/lib/types";
import { useConversation } from "./use-conversation";

const REF: PullRequestRef = { owner: "acme", repo: "app", number: 7 };

const EMPTY: Conversation = { comments: [], reviews: [], truncated: false };
const WITH_COMMENT: Conversation = {
  comments: [
    {
      id: 1,
      inReplyTo: null,
      path: "a.ts",
      line: 3,
      side: "RIGHT",
      author: "sam",
      body: "Rename this",
      url: "https://github.com/acme/app/pull/7#discussion_r1",
      createdAt: "2026-10-01T10:00:00Z",
    },
  ],
  reviews: [],
  truncated: false,
};

let currentConversation: Conversation;

async function settle() {
  await act(() => new Promise((resolve) => setTimeout(resolve, 0)));
}

describe("useConversation", () => {
  beforeEach(() => {
    currentConversation = EMPTY;
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json(currentConversation)),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("refreshConversation loads the comments posted since the first load", async () => {
    const { result } = renderHook(() => useConversation(REF));
    await settle();
    expect(result.current.conversation.comments).toHaveLength(0);
    currentConversation = WITH_COMMENT;
    await act(() => result.current.refreshConversation());
    expect(result.current.conversation.comments).toHaveLength(1);
  });

  it("refreshConversation reports a failed load without dropping the list", async () => {
    currentConversation = WITH_COMMENT;
    const { result } = renderHook(() => useConversation(REF));
    await settle();
    vi.mocked(fetch).mockRejectedValueOnce(new Error("network down"));
    await act(() => result.current.refreshConversation());
    expect(result.current.conversationError).toBe("network down");
    expect(result.current.conversation.comments).toHaveLength(1);
  });
});
