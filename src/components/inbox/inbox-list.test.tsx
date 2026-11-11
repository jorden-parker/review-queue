import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { TooltipProvider } from "@/components/ui/tooltip";
import type { ReviewRequest } from "@/lib/github/gh";
import { reviewRequests, sessionStore } from "@/lib/review/services";
import { InboxList } from "./inbox-list";

vi.mock("next/server", () => ({ connection: vi.fn(async () => undefined) }));
vi.mock("@/lib/review/services", () => ({ reviewRequests: vi.fn(), sessionStore: vi.fn() }));

const REQUEST: ReviewRequest = {
  ref: { owner: "acme", repo: "app", number: 7 },
  title: "Add retry",
  url: "https://github.com/acme/app/pull/7",
  author: "sam",
  updatedAt: "2026-10-28T09:00:00.000Z",
  isDraft: false,
};

async function renderInbox() {
  render(await InboxList(), { wrapper: TooltipProvider });
}

beforeEach(() => {
  vi.mocked(reviewRequests).mockResolvedValue([REQUEST]);
  vi.mocked(sessionStore).mockReturnValue({
    inProgress: () => [],
    archived: () => [],
    recentSubmissions: () => [],
    progressSummaries: () => ({}),
  } as unknown as ReturnType<typeof sessionStore>);
});

describe("InboxList rows", () => {
  it("gives each queued pull request a hairline hover border", async () => {
    await renderInbox();
    const classes = screen.getByRole("link", { name: /Add retry/ }).classList;
    expect(classes.contains("hover:border-foreground/20")).toBe(true);
    expect(classes.contains("hover:bg-accent")).toBe(true);
  });

  it("sets the row title in semibold", async () => {
    await renderInbox();
    expect(screen.getByText("Add retry").closest(".font-semibold")).not.toBeNull();
  });

  it("draws the queue on a hairline border rather than a ring", async () => {
    await renderInbox();
    const list = screen.getByRole("link", { name: /Add retry/ }).closest("ul");
    expect(list?.classList.contains("border")).toBe(true);
    expect(list?.classList.contains("ring-1")).toBe(false);
  });
});

describe("InboxList states", () => {
  it("draws the empty queue on a hairline border rather than a ring", async () => {
    vi.mocked(reviewRequests).mockResolvedValue([]);
    const { container } = render(await InboxList(), { wrapper: TooltipProvider });
    const classes = (container.querySelector(".rounded-xl") as HTMLElement).classList;
    expect(classes.contains("border")).toBe(true);
    expect(classes.contains("ring-1")).toBe(false);
  });

  it("tints the GitHub error card with a destructive border", async () => {
    vi.mocked(reviewRequests).mockRejectedValue(new Error("gh is not logged in"));
    await renderInbox();
    const card = screen.getByText(/reach GitHub through/).closest('[data-slot="card"]');
    expect(card).not.toBeNull();
    const classes = (card as HTMLElement).classList;
    expect(classes.contains("border-destructive/40")).toBe(true);
    expect(classes.contains("ring-destructive/40")).toBe(false);
  });
});
