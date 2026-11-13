import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { TooltipProvider } from "@/components/ui/tooltip";
import type { ReviewRequest } from "@/lib/github/gh";
import { prKey } from "@/lib/pr-ref";
import { openPullRequests, reviewRequests, sessionStore } from "@/lib/review/services";
import { savedRepositories } from "@/lib/settings/repository-settings";
import { InboxList } from "./inbox-list";

vi.mock("next/server", () => ({ connection: vi.fn(async () => undefined) }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
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
  it("highlights the whole queued row on hover", async () => {
    await renderInbox();
    const row = screen.getByRole("link", { name: /Add retry/ }).closest("li");
    expect(row?.classList.contains("hover:bg-muted")).toBe(true);
  });

  it("makes the row title link cover the whole row", async () => {
    await renderInbox();
    const link = screen.getByRole("link", { name: /Add retry/ });
    expect(link.classList.contains("after:inset-0")).toBe(true);
    expect(link.getAttribute("href")).toBe("/pr/acme/app/7");
  });

  it("shows the repository, number and author on the row", async () => {
    await renderInbox();
    expect(screen.getByText("acme/app · #7")).toBeTruthy();
    expect(screen.getByText("by sam")).toBeTruthy();
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

describe("InboxList pick up", () => {
  const RECENT = new Date(Date.now() - 40 * 60_000).toISOString();
  const OLDER = "2026-10-20T09:00:00.000Z";

  function withInProgress(sessions: unknown[]) {
    vi.mocked(sessionStore).mockReturnValue({
      inProgress: () => sessions,
      archived: () => [],
      recentSubmissions: () => [],
      progressSummaries: () => ({}),
    } as unknown as ReturnType<typeof sessionStore>);
  }

  it("shows the most recent in-progress review as the one card to resume", async () => {
    withInProgress([
      {
        key: "acme/app#9",
        title: "Retry webhooks",
        doneCount: 3,
        pauseNote: null,
        updatedAt: RECENT,
      },
      { key: "acme/web#4", title: "Old work", doneCount: 1, pauseNote: null, updatedAt: OLDER },
    ]);
    await renderInbox();
    expect(screen.getByRole("heading", { name: "Pick up where you left off" })).toBeTruthy();
    expect(screen.getByRole("link", { name: /Resume review/ }).getAttribute("href")).toBe(
      "/pr/acme/app/9",
    );
    expect(screen.getByRole("heading", { name: /Also in progress/ })).toBeTruthy();
    expect(screen.getByRole("link", { name: /Old work/ }).getAttribute("href")).toBe(
      "/pr/acme/web/4",
    );
  });

  it("leaves out the card when nothing is in progress", async () => {
    await renderInbox();
    expect(screen.queryByText("Pick up where you left off")).toBeNull();
  });
});

describe("InboxList folded extras", () => {
  it("folds the PR form, Dependabot link, posted reviews and archive into one disclosure", async () => {
    await renderInbox();
    const disclosure = screen.getByText("Open another PR, Dependabot, archive…").closest("details");
    expect(disclosure?.open).toBe(false);
    expect(
      within(disclosure as HTMLElement).getByLabelText("PR link or owner/repo#number"),
    ).toBeTruthy();
    expect(
      within(disclosure as HTMLElement).getByRole("link", { name: "Dependabot PRs" }),
    ).toBeTruthy();
    expect(within(disclosure as HTMLElement).getByRole("heading", { name: "Posted" })).toBeTruthy();
  });

  it("keeps the waiting list outside the disclosure", async () => {
    await renderInbox();
    const disclosure = screen.getByText("Open another PR, Dependabot, archive…").closest("details");
    expect(disclosure?.contains(screen.getByRole("link", { name: /Add retry/ }))).toBe(false);
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
    expect(screen.getByRole("heading", { name: /Open in your repositories · 0/ })).toBeTruthy();
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
