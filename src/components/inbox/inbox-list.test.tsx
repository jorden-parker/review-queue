import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { TooltipProvider } from "@/components/ui/tooltip";
import type { ReviewRequest } from "@/lib/github/gh";
import { prKey } from "@/lib/pr-ref";
import { openPullRequests, reviewRequests, sessionStore } from "@/lib/review/services";
import { savedRepositories } from "@/lib/settings/repository-settings";
import { InboxList } from "./inbox-list";

vi.mock("next/server", () => ({ connection: vi.fn(async () => undefined) }));
vi.mock("@/lib/review/services", () => ({
  reviewRequests: vi.fn(),
  openPullRequests: vi.fn(),
  sessionStore: vi.fn(),
}));
vi.mock("@/lib/settings/repository-settings", () => ({ savedRepositories: vi.fn() }));

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
  vi.mocked(openPullRequests).mockResolvedValue([]);
  vi.mocked(savedRepositories).mockReturnValue(["acme/app"]);
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

  it("links each queued pull request to GitHub outside the row link", async () => {
    await renderInbox();
    const link = screen.getByRole("link", { name: "Open acme/app#7 on GitHub" });
    expect(link.getAttribute("href")).toBe("https://github.com/acme/app/pull/7");
    expect(link.getAttribute("target")).toBe("_blank");
    expect(link.getAttribute("rel")).toBe("noopener noreferrer");
    expect(link.closest('a[href^="/pr/"]')).toBeNull();
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

const REPOSITORY_REQUEST: ReviewRequest = {
  ref: { owner: "acme", repo: "web", number: 3 },
  title: "Bump lodash",
  url: "https://github.com/acme/web/pull/3",
  author: "lee",
  updatedAt: "2026-10-27T09:00:00.000Z",
  isDraft: false,
};

function repositorySection(): HTMLElement {
  const heading = screen.getByRole("heading", { name: /Open in your repositories/ });
  return heading.closest("section") as HTMLElement;
}

describe("InboxList repositories", () => {
  it("lists open pull requests from your repositories in their own section", async () => {
    vi.mocked(openPullRequests).mockResolvedValue([REPOSITORY_REQUEST]);
    await renderInbox();
    expect(openPullRequests).toHaveBeenCalledWith("others");
    expect(within(repositorySection()).getByRole("link", { name: /Bump lodash/ })).toBeTruthy();
    expect(screen.getByRole("heading", { name: /Waiting for you/ })).toBeTruthy();
  });

  it("leaves out pull requests already waiting for you", async () => {
    vi.mocked(openPullRequests).mockResolvedValue([REQUEST]);
    await renderInbox();
    expect(screen.getAllByRole("link", { name: /Add retry/ })).toHaveLength(1);
    expect(screen.getByRole("heading", { name: /Open in your repositories \(0\)/ })).toBeTruthy();
  });

  it("links the repositories section to the Dependabot page", async () => {
    await renderInbox();
    const link = screen.getByRole("link", { name: "Dependabot PRs" });
    expect(link.getAttribute("href")).toBe("/dependabot");
  });

  it("asks for repositories in Settings when none are saved", async () => {
    vi.mocked(savedRepositories).mockReturnValue([]);
    await renderInbox();
    expect(screen.getByRole("link", { name: "Settings" }).getAttribute("href")).toBe("/settings");
    expect(screen.queryByRole("heading", { name: /Open in your repositories/ })).toBeNull();
    expect(screen.getByRole("heading", { name: /Waiting for you/ })).toBeTruthy();
  });

  it("shows a repository failure only inside its section", async () => {
    vi.mocked(openPullRequests).mockRejectedValue(new Error("search failed"));
    await renderInbox();
    expect(screen.getByRole("link", { name: /Add retry/ })).toBeTruthy();
    expect(within(repositorySection()).getByText(/reach GitHub/)).toBeTruthy();
    expect(screen.getAllByText(/reach GitHub/)).toHaveLength(1);
  });

  it("asks for progress on the repository pull requests too", async () => {
    vi.mocked(openPullRequests).mockResolvedValue([REPOSITORY_REQUEST]);
    const progressSummaries = vi.fn(() => ({}));
    vi.mocked(sessionStore).mockReturnValue({
      inProgress: () => [],
      archived: () => [],
      recentSubmissions: () => [],
      progressSummaries,
    } as unknown as ReturnType<typeof sessionStore>);
    await renderInbox();
    expect(progressSummaries).toHaveBeenCalledWith(
      expect.arrayContaining([prKey(REPOSITORY_REQUEST.ref)]),
    );
  });
});
