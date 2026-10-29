import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { LinkedIssue } from "@/lib/github/gh";
import { LinkedIssues } from "./linked-issues";

const OPEN_ISSUE: LinkedIssue = {
  owner: "acme",
  repo: "app",
  number: 12,
  title: "Crash on save",
  state: "open",
  url: "https://github.com/acme/app/issues/12",
  bodyHtml: "<p>It crashes when saving twice</p>",
};

const CLOSED_ISSUE: LinkedIssue = {
  owner: "acme",
  repo: "app",
  number: 13,
  title: "Old crash",
  state: "closed",
  url: "https://github.com/acme/app/issues/13",
  bodyHtml: "",
};

describe("LinkedIssues", () => {
  it("renders nothing when the PR closes no issues", () => {
    const { container } = render(<LinkedIssues issues={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it("names the issue and shows its title", () => {
    render(<LinkedIssues issues={[OPEN_ISSUE]} />);
    expect(screen.getByRole("link", { name: "acme/app#12" }).getAttribute("href")).toBe(
      OPEN_ISSUE.url,
    );
    expect(screen.getByText("Crash on save")).toBeTruthy();
  });

  it("hides the issue body until Show issue is clicked", () => {
    render(<LinkedIssues issues={[OPEN_ISSUE]} />);
    expect(screen.queryByText("It crashes when saving twice")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Show issue" }));
    expect(screen.getByText("It crashes when saving twice")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Hide issue" }));
    expect(screen.queryByText("It crashes when saving twice")).toBeNull();
  });

  it("marks a closed issue", () => {
    render(<LinkedIssues issues={[CLOSED_ISSUE]} />);
    expect(screen.getByText("Closed")).toBeTruthy();
  });
});
