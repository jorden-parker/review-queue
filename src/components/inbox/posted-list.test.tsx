import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { RecentSubmission } from "@/lib/session/store";
import { POSTED_REVIEW_LIMIT, PostedList } from "./posted-list";

const THREE_HOURS_AGO = new Date(Date.now() - 3 * 3_600_000).toISOString();
const REVIEW_URL = "https://github.com/acme/app/pull/7#pullrequestreview-1";

function review(overrides: Partial<RecentSubmission> = {}): RecentSubmission {
  return {
    key: "acme/app#7",
    title: "Add retry",
    reviewId: 1,
    url: REVIEW_URL,
    event: "REQUEST_CHANGES",
    postedAt: THREE_HOURS_AGO,
    ...overrides,
  };
}

describe("PostedList", () => {
  it("shows the title, reference, verdict and how long ago it was posted", () => {
    render(<PostedList reviews={[review()]} />);
    expect(screen.getByText("Add retry")).toBeTruthy();
    expect(screen.getByText("acme/app#7")).toBeTruthy();
    expect(screen.getByText("Changes requested")).toBeTruthy();
    expect(screen.getByText("posted 3h ago")).toBeTruthy();
  });

  it("links to the review on GitHub in a new tab and to the pull request in the app", () => {
    render(<PostedList reviews={[review()]} />);
    const github = screen.getByRole("link", { name: "On GitHub" });
    expect(github.getAttribute("href")).toBe(REVIEW_URL);
    expect(github.getAttribute("target")).toBe("_blank");
    expect(screen.getByRole("link", { name: "Open" }).getAttribute("href")).toBe("/pr/acme/app/7");
  });

  it("uses the reference in place of a missing title", () => {
    render(<PostedList reviews={[review({ title: null })]} />);
    expect(screen.getAllByText("acme/app#7")).toHaveLength(2);
  });

  it("keeps one row per receipt when a pull request was reviewed twice", () => {
    render(<PostedList reviews={[review({ reviewId: 1 }), review({ reviewId: 2 })]} />);
    expect(screen.getAllByRole("listitem")).toHaveLength(2);
  });

  it("says nothing has been posted yet", () => {
    render(<PostedList reviews={[]} />);
    expect(screen.getByRole("heading", { name: "Posted" })).toBeTruthy();
    expect(screen.getByText("Nothing posted yet")).toBeTruthy();
  });

  it("says the list is cut off at the limit", () => {
    const reviews = Array.from({ length: POSTED_REVIEW_LIMIT }, (_, index) =>
      review({ reviewId: index + 1 }),
    );
    render(<PostedList reviews={reviews} />);
    expect(screen.getByText(`Showing the latest ${POSTED_REVIEW_LIMIT}`)).toBeTruthy();
  });

  it("draws the posted list on a hairline border rather than a ring", () => {
    const { container } = render(<PostedList reviews={[review()]} />);
    expect(container.querySelector("ul")?.classList.contains("border")).toBe(true);
    expect(container.querySelector(".ring-1")).toBeNull();
  });

  it("draws the empty posted state on a hairline border rather than a ring", () => {
    const { container } = render(<PostedList reviews={[]} />);
    const classes = (container.querySelector(".rounded-xl") as HTMLElement).classList;
    expect(classes.contains("border")).toBe(true);
    expect(classes.contains("ring-1")).toBe(false);
  });
});
