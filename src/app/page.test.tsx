import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import InboxPage from "./page";

vi.mock("@/components/inbox/inbox-list", () => ({ InboxList: () => null }));
vi.mock("@/components/inbox/open-pull-request-form", () => ({
  OpenPullRequestForm: () => null,
}));

describe("InboxPage", () => {
  it("highlights the word queue in the whimsy gradient", () => {
    render(<InboxPage />);
    expect(screen.getByText("queue").classList.contains("text-whimsy")).toBe(true);
  });

  it("wiggles the otter on hover", () => {
    render(<InboxPage />);
    expect(screen.getByText("🦦").classList.contains("hover:animate-wiggle")).toBe(true);
  });
});
