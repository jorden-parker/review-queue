import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRef } from "react";
import { describe, expect, it, vi } from "vitest";
import { TooltipProvider } from "@/components/ui/tooltip";
import type { InProgressSession } from "@/lib/session/store";
import { ArchivedList } from "./archived-list";

const SESSION: InProgressSession = {
  key: "acme/app#7",
  title: "Add retry",
  doneCount: 2,
  pauseNote: null,
  updatedAt: "2026-10-28T09:00:00.000Z",
};

function renderArchived(sessions: InProgressSession[], onRestore = vi.fn()) {
  render(
    <ArchivedList
      sessions={sessions}
      busy={false}
      onRestore={onRestore}
      summaryRef={createRef<HTMLElement>()}
    />,
    { wrapper: TooltipProvider },
  );
  return onRestore;
}

describe("ArchivedList", () => {
  it("renders nothing when no session is archived", () => {
    const { container } = render(
      <ArchivedList
        sessions={[]}
        busy={false}
        onRestore={vi.fn()}
        summaryRef={createRef<HTMLElement>()}
      />,
    );
    expect(container.innerHTML).toBe("");
  });

  it("is collapsed by default and shows the count in its summary", () => {
    renderArchived([SESSION]);
    expect(screen.getByText("Archived").closest("details")?.open).toBe(false);
    expect(screen.getByText("(1)")).toBeTruthy();
  });

  it("shows the explainer and a Restore button for each session once expanded", async () => {
    renderArchived([SESSION]);
    await userEvent.click(screen.getByText("Archived"));
    expect(
      screen.getByText(
        /stay out of .Also in progress. until you restore them or push a new commit to the PR/,
      ),
    ).toBeTruthy();
    expect(screen.getByRole("button", { name: "Restore acme/app#7" })).toBeTruthy();
  });

  it("passes the session to onRestore when its Restore button is clicked", async () => {
    const onRestore = renderArchived([SESSION]);
    await userEvent.click(screen.getByText("Archived"));
    await userEvent.click(screen.getByRole("button", { name: "Restore acme/app#7" }));
    expect(onRestore).toHaveBeenCalledWith(SESSION);
  });
});
