import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { Conversation } from "@/lib/github/conversation";
import type { PostedReview, ReviewComment } from "@/lib/github/gh";
import type { Session } from "@/lib/session/store";
import { ConversationPanel } from "./conversation-panel";
import { threadsFor } from "./conversation-threads";

function comment(overrides: Partial<ReviewComment> & { id: number }): ReviewComment {
  return {
    inReplyTo: null,
    path: "a.ts",
    line: 3,
    side: "RIGHT",
    author: "sam",
    body: "Rename this",
    url: `https://github.com/acme/app/pull/7#discussion_r${overrides.id}`,
    createdAt: "2026-10-01T10:00:00Z",
    ...overrides,
  };
}

function review(overrides: Partial<PostedReview> & { id: number }): PostedReview {
  return {
    author: "kim",
    state: "COMMENTED",
    body: "",
    url: `https://github.com/acme/app/pull/7#pullrequestreview-${overrides.id}`,
    submittedAt: "2026-10-01T11:00:00Z",
    commitId: "abc",
    ...overrides,
  };
}

function renderPanel({
  comments = [],
  reviews = [],
  truncated = false,
  receipts = [],
  error = null,
}: {
  comments?: ReviewComment[];
  reviews?: PostedReview[];
  truncated?: boolean;
  receipts?: Session["submissions"];
  error?: string | null;
}) {
  const onOpen = vi.fn();
  const conversation: Conversation = { comments, reviews, truncated };
  render(
    <ConversationPanel
      conversation={conversation}
      error={error}
      threads={threadsFor(comments)}
      receipts={receipts}
      onOpen={onOpen}
    />,
  );
  return { onOpen };
}

describe("ConversationPanel", () => {
  it("lists each review with its state and author", () => {
    renderPanel({
      reviews: [review({ id: 9, author: "kim", state: "CHANGES_REQUESTED", body: "Split it" })],
    });
    expect(screen.getByText("kim")).toBeTruthy();
    expect(screen.getByText("Changes requested")).toBeTruthy();
    expect(screen.getByText("Split it")).toBeTruthy();
  });

  it("shows each thread with its reply count and jumps to its line", async () => {
    const user = userEvent.setup();
    const { onOpen } = renderPanel({
      comments: [comment({ id: 1 }), comment({ id: 2, inReplyTo: 1, author: "kim", body: "Done" })],
    });
    expect(screen.getByText("Rename this")).toBeTruthy();
    expect(screen.getByText("1 reply")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Open a.ts line 3" }));
    expect(onOpen).toHaveBeenCalledWith({ path: "a.ts", line: 3 });
  });

  it("marks an outdated thread and offers no jump for it", () => {
    renderPanel({ comments: [comment({ id: 1, line: null })] });
    expect(screen.getByText("Outdated")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Open a\.ts/ })).toBeNull();
  });

  it("says when only the first page is shown", () => {
    renderPanel({ reviews: [review({ id: 9 })], truncated: true });
    expect(screen.getByText("Showing the first 100")).toBeTruthy();
  });

  it("lists your own receipts with their verdict and a link", () => {
    renderPanel({
      receipts: [
        {
          reviewId: 42,
          url: "https://github.com/acme/app/pull/7#pullrequestreview-42",
          event: "APPROVE",
          headSha: "abc",
          body: "Nice work",
          postedAt: "2026-10-01T12:00:00Z",
        },
      ],
    });
    expect(screen.getByText("You posted")).toBeTruthy();
    expect(screen.getByText("Approved")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Open" }).getAttribute("href")).toBe(
      "https://github.com/acme/app/pull/7#pullrequestreview-42",
    );
  });

  it("explains that the conversation could not load", () => {
    renderPanel({ error: "gh: 502" });
    expect(screen.getByText(/Could not load the conversation/)).toBeTruthy();
  });
});
