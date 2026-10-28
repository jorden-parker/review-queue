import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Conversation } from "@/lib/github/conversation";
import type { PostedReview, ReviewComment } from "@/lib/github/gh";
import type { Session } from "@/lib/session/store";
import { ConversationPanel } from "./conversation-panel";
import { threadsFor } from "./conversation-threads";
import type { LineTarget } from "./locate";

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

type PanelProps = {
  comments?: ReviewComment[];
  reviews?: PostedReview[];
  truncated?: boolean;
  receipts?: Session["submissions"];
  replyReceipts?: Session["replyReceipts"];
  error?: string | null;
  onReply?: (commentId: number, body: string) => Promise<number>;
  onOpen?: (target: LineTarget) => void;
};

function acceptingReply() {
  return vi.fn(async () => 77);
}

function panelElement({
  comments = [],
  reviews = [],
  truncated = false,
  receipts = [],
  replyReceipts = [],
  error = null,
  onReply = acceptingReply(),
  onOpen = vi.fn(),
}: PanelProps) {
  const conversation: Conversation = { comments, reviews, truncated };
  return (
    <ConversationPanel
      conversation={conversation}
      error={error}
      threads={threadsFor(comments)}
      receipts={receipts}
      replyReceipts={replyReceipts}
      onOpen={onOpen}
      onReply={onReply}
    />
  );
}

function renderPanel({ onReply = acceptingReply(), onOpen = vi.fn(), ...props }: PanelProps = {}) {
  const { rerender } = render(panelElement({ ...props, onReply, onOpen }));
  return { onOpen, onReply, rerender };
}

function replyButton(name: string): HTMLElement {
  return screen.getByRole("button", { name });
}

function replyTextbox(): HTMLTextAreaElement {
  return screen.getByRole("textbox", { name: "Reply text" }) as HTMLTextAreaElement;
}

function postReplyButton(): HTMLButtonElement {
  return screen.getByRole("button", { name: "Post reply" }) as HTMLButtonElement;
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

  it("shows the text of each reply under its thread, oldest first", () => {
    renderPanel({
      comments: [
        comment({ id: 1, body: "Rename this" }),
        comment({
          id: 3,
          inReplyTo: 1,
          author: "sam",
          body: "Thanks",
          createdAt: "2026-10-01T11:00:00Z",
        }),
        comment({
          id: 2,
          inReplyTo: 1,
          author: "kim",
          body: "Done",
          createdAt: "2026-10-01T10:30:00Z",
        }),
      ],
    });
    const done = screen.getByText("Done");
    const thanks = screen.getByText("Thanks");
    expect(done.compareDocumentPosition(thanks) & Node.DOCUMENT_POSITION_FOLLOWING).toBeGreaterThan(
      0,
    );
  });

  it("marks an outdated thread and offers no jump for it", () => {
    renderPanel({ comments: [comment({ id: 1, line: null })] });
    expect(screen.getByText("Outdated")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Open a\.ts/ })).toBeNull();
  });

  it("offers no jump for a thread on the old side of the diff", () => {
    renderPanel({ comments: [comment({ id: 1, side: "LEFT", line: 3 })] });
    expect(screen.getByText("Rename this")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Open a\.ts/ })).toBeNull();
  });

  it("says when part of the conversation is not shown", () => {
    renderPanel({ reviews: [review({ id: 9 })], truncated: true });
    expect(
      screen.getByText("Showing part of the conversation. The rest is on GitHub."),
    ).toBeTruthy();
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

  it("lists your replies under You posted with a link", () => {
    renderPanel({
      replyReceipts: [
        {
          replyId: 77,
          parentCommentId: 1,
          url: "https://github.com/acme/app/pull/7#discussion_r77",
          body: "Thanks",
          postedAt: "2026-10-01T12:00:00Z",
        },
      ],
    });
    expect(screen.getByText("You posted")).toBeTruthy();
    expect(screen.getByText("Reply")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Open" }).getAttribute("href")).toBe(
      "https://github.com/acme/app/pull/7#discussion_r77",
    );
  });

  describe("replying", () => {
    beforeEach(() => {
      Element.prototype.scrollIntoView = vi.fn();
    });

    it("offers Reply on each thread and keeps one composer open at a time", async () => {
      const user = userEvent.setup();
      renderPanel({
        comments: [
          comment({ id: 1, path: "a.ts", line: 3 }),
          comment({ id: 2, path: "b.ts", line: 5 }),
        ],
      });
      await user.click(replyButton("Reply to a.ts line 3"));
      expect(screen.getAllByRole("textbox", { name: "Reply text" })).toHaveLength(1);
      await user.click(replyButton("Reply to b.ts line 5"));
      expect(screen.getAllByRole("textbox", { name: "Reply text" })).toHaveLength(1);
    });

    it("keeps Post reply disabled until there is text", async () => {
      const user = userEvent.setup();
      renderPanel({ comments: [comment({ id: 1 })] });
      await user.click(replyButton("Reply to a.ts line 3"));
      expect(postReplyButton().disabled).toBe(true);
      await user.type(replyTextbox(), "Hi");
      expect(postReplyButton().disabled).toBe(false);
    });

    it("shows a character count against the limit", async () => {
      const user = userEvent.setup();
      renderPanel({ comments: [comment({ id: 1 })] });
      await user.click(replyButton("Reply to a.ts line 3"));
      await user.type(replyTextbox(), "Hi");
      expect(screen.getByText("2/10000")).toBeTruthy();
    });

    it("asks for confirmation and previews the reply as Markdown before posting", async () => {
      const user = userEvent.setup();
      const { onReply } = renderPanel({ comments: [comment({ id: 1 })] });
      await user.click(replyButton("Reply to a.ts line 3"));
      await user.type(replyTextbox(), "Use `map` here");
      await user.click(postReplyButton());
      expect(screen.getByText("Post this reply to GitHub?")).toBeTruthy();
      expect(screen.getByText("map", { selector: "code" })).toBeTruthy();
      expect(onReply).not.toHaveBeenCalled();
    });

    it("keeps the draft when you choose Not yet", async () => {
      const user = userEvent.setup();
      const { onReply } = renderPanel({ comments: [comment({ id: 1 })] });
      await user.click(replyButton("Reply to a.ts line 3"));
      await user.type(replyTextbox(), "Use `map` here");
      await user.click(postReplyButton());
      await user.click(screen.getByRole("button", { name: "Not yet" }));
      expect(screen.queryByText("Post this reply to GitHub?")).toBeNull();
      expect(replyTextbox().value).toBe("Use `map` here");
      expect(onReply).not.toHaveBeenCalled();
    });

    it("posts after confirmation and scrolls the new reply into view", async () => {
      const user = userEvent.setup();
      const { onReply } = renderPanel({
        comments: [
          comment({ id: 1 }),
          comment({
            id: 77,
            inReplyTo: 1,
            author: "kim",
            body: "Thanks",
            createdAt: "2026-10-01T11:00:00Z",
          }),
        ],
        onReply: vi.fn(async () => 77),
      });
      await user.click(replyButton("Reply to a.ts line 3"));
      await user.type(replyTextbox(), "Thanks");
      await user.click(postReplyButton());
      await user.click(screen.getByRole("button", { name: "Post to GitHub" }));
      await waitFor(() => expect(vi.mocked(Element.prototype.scrollIntoView)).toHaveBeenCalled());
      expect(onReply).toHaveBeenCalledWith(1, "Thanks");
      expect(screen.queryByRole("textbox", { name: "Reply text" })).toBeNull();
    });

    it("scrolls to the new reply once, not again when the threads are rebuilt", async () => {
      const user = userEvent.setup();
      const comments = [
        comment({ id: 1 }),
        comment({
          id: 77,
          inReplyTo: 1,
          author: "kim",
          body: "Thanks",
          createdAt: "2026-10-01T11:00:00Z",
        }),
      ];
      const { rerender } = renderPanel({ comments, onReply: vi.fn(async () => 77) });
      await user.click(replyButton("Reply to a.ts line 3"));
      await user.type(replyTextbox(), "Thanks");
      await user.click(postReplyButton());
      await user.click(screen.getByRole("button", { name: "Post to GitHub" }));
      const scrollIntoView = vi.mocked(Element.prototype.scrollIntoView);
      await waitFor(() => expect(scrollIntoView).toHaveBeenCalledTimes(1));
      rerender(panelElement({ comments: [] }));
      rerender(panelElement({ comments }));
      expect(scrollIntoView).toHaveBeenCalledTimes(1);
    });

    it("shows GitHub's refusal in the dialog and keeps the draft", async () => {
      const user = userEvent.setup();
      renderPanel({
        comments: [comment({ id: 1 })],
        onReply: vi.fn(async () => {
          throw new Error("GitHub did not accept the reply.");
        }),
      });
      await user.click(replyButton("Reply to a.ts line 3"));
      await user.type(replyTextbox(), "Thanks");
      await user.click(postReplyButton());
      await user.click(screen.getByRole("button", { name: "Post to GitHub" }));
      expect(await screen.findByText("GitHub did not accept the reply.")).toBeTruthy();
      expect(screen.getByText("Post this reply to GitHub?")).toBeTruthy();
      await user.click(screen.getByRole("button", { name: "Not yet" }));
      expect(replyTextbox().value).toBe("Thanks");
    });
  });
});
