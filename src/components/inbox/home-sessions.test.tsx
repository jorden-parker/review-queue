import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { sendSessionAction } from "@/components/review/api";
import { TooltipProvider } from "@/components/ui/tooltip";
import type { InProgressSession } from "@/lib/session/store";
import { HomeSessions } from "./home-sessions";

vi.mock("@/components/review/api", () => ({ sendSessionAction: vi.fn() }));

const ADD_RETRY: InProgressSession = {
  key: "acme/app#7",
  title: "Add retry",
  doneCount: 2,
  pauseNote: null,
  updatedAt: "2026-10-28T09:00:00.000Z",
};

const FIX_CACHE: InProgressSession = {
  key: "acme/app#8",
  title: "Fix cache",
  doneCount: 0,
  pauseNote: "later",
  updatedAt: "2026-10-27T09:00:00.000Z",
};

function renderHome(inProgress: InProgressSession[], archived: InProgressSession[] = []) {
  render(<HomeSessions inProgress={inProgress} archived={archived} />, {
    wrapper: TooltipProvider,
  });
}

describe("HomeSessions", () => {
  beforeEach(() => {
    vi.mocked(sendSessionAction).mockReset();
    vi.mocked(sendSessionAction).mockResolvedValue({} as never);
  });

  it("moves an archived row out of Also in progress and into Archived", async () => {
    renderHome([ADD_RETRY]);
    await userEvent.click(screen.getByRole("button", { name: "Archive acme/app#7" }));
    expect(sendSessionAction).toHaveBeenCalledWith(
      { owner: "acme", repo: "app", number: 7 },
      { type: "archive" },
    );
    expect(await screen.findByText("Archived")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Archive acme/app#7" })).toBeNull();
  });

  it("moves focus to the Archived summary after archiving", async () => {
    renderHome([ADD_RETRY, FIX_CACHE]);
    await userEvent.click(screen.getByRole("button", { name: "Archive acme/app#7" }));
    await screen.findByText("Archived");
    expect(document.activeElement?.tagName).toBe("SUMMARY");
  });

  it("moves a row back to Also in progress when Restore succeeds, and focuses the heading", async () => {
    renderHome([], [ADD_RETRY]);
    await userEvent.click(screen.getByText("Archived"));
    await userEvent.click(screen.getByRole("button", { name: "Restore acme/app#7" }));
    expect(sendSessionAction).toHaveBeenCalledWith(
      { owner: "acme", repo: "app", number: 7 },
      { type: "unarchive" },
    );
    expect(await screen.findByRole("heading", { name: /Also in progress/ })).toBeTruthy();
    expect(document.activeElement?.tagName).toBe("H2");
  });

  it("keeps the row in place and shows an alert when the action fails", async () => {
    vi.mocked(sendSessionAction).mockRejectedValueOnce(new Error("boom"));
    renderHome([ADD_RETRY]);
    await userEvent.click(screen.getByRole("button", { name: "Archive acme/app#7" }));
    expect((await screen.findByRole("alert")).textContent).toBe(
      "Couldn't archive acme/app#7. Try again.",
    );
    expect(screen.getByRole("button", { name: "Archive acme/app#7" })).toBeTruthy();
  });
});
