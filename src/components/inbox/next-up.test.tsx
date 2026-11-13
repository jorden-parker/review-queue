import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { TooltipProvider } from "@/components/ui/tooltip";
import type { InProgressSession } from "@/lib/session/store";
import { NextUp } from "./next-up";

const SESSION: InProgressSession = {
  key: "acme/app#9",
  title: "Retry webhook deliveries",
  doneCount: 3,
  pauseNote: "check the backoff cap",
  updatedAt: new Date(Date.now() - 40 * 60_000).toISOString(),
};

function renderNextUp(session: InProgressSession) {
  return render(<NextUp session={session} />, { wrapper: TooltipProvider });
}

describe("NextUp", () => {
  it("titles the section Pick up where you left off", () => {
    renderNextUp(SESSION);
    expect(screen.getByRole("heading", { name: "Pick up where you left off" })).toBeTruthy();
  });

  it("shows the repository, number, title and steps done", () => {
    renderNextUp(SESSION);
    expect(screen.getByText("acme/app · #9")).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Retry webhook deliveries" })).toBeTruthy();
    expect(screen.getByText("3 steps done")).toBeTruthy();
  });

  it("quotes the note the reviewer left before pausing", () => {
    renderNextUp(SESSION);
    expect(screen.getByText("You were about to: check the backoff cap")).toBeTruthy();
  });

  it("leaves out the pause note when there is none", () => {
    renderNextUp({ ...SESSION, pauseNote: null });
    expect(screen.queryByText(/You were about to/)).toBeNull();
  });

  it("links the primary Resume review button to the pull request", () => {
    renderNextUp(SESSION);
    const link = screen.getByRole("link", { name: /Resume review/ });
    expect(link.getAttribute("href")).toBe("/pr/acme/app/9");
    expect(link.classList.contains("bg-primary")).toBe(true);
  });

  it("draws a rainbow top edge", () => {
    const { container } = renderNextUp(SESSION);
    expect(container.querySelector(".rainbow-rule")).not.toBeNull();
  });

  it("renders nothing when the key does not name a pull request", () => {
    const { container } = renderNextUp({ ...SESSION, key: "not-a-pr" });
    expect(container.innerHTML).toBe("");
  });
});
