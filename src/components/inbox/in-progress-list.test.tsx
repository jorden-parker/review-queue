import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRef } from "react";
import { describe, expect, it, vi } from "vitest";
import { TooltipProvider } from "@/components/ui/tooltip";
import type { InProgressSession } from "@/lib/session/store";
import { InProgressList } from "./in-progress-list";

const SESSION: InProgressSession = {
  key: "acme/app#7",
  title: "Add retry",
  doneCount: 2,
  pauseNote: null,
  updatedAt: "2026-10-28T09:00:00.000Z",
};

function renderList(sessions: InProgressSession[], onArchive = vi.fn()) {
  render(
    <InProgressList
      sessions={sessions}
      busy={false}
      onArchive={onArchive}
      headingRef={createRef<HTMLHeadingElement>()}
    />,
    { wrapper: TooltipProvider },
  );
  return onArchive;
}

describe("InProgressList", () => {
  it("renders nothing when no session is in progress", () => {
    const { container } = render(
      <InProgressList
        sessions={[]}
        busy={false}
        onArchive={vi.fn()}
        headingRef={createRef<HTMLHeadingElement>()}
      />,
    );
    expect(container.innerHTML).toBe("");
  });

  it("labels each row's archive button with its PR key", () => {
    renderList([SESSION]);
    expect(screen.getByRole("button", { name: "Archive acme/app#7" })).toBeTruthy();
  });

  it("passes the session to onArchive when its archive button is clicked", async () => {
    const onArchive = renderList([SESSION]);
    await userEvent.click(screen.getByRole("button", { name: "Archive acme/app#7" }));
    expect(onArchive).toHaveBeenCalledWith(SESSION);
  });

  it("links the row's title to its pull request", () => {
    renderList([SESSION]);
    expect(screen.getByRole("link", { name: /Add retry/ }).getAttribute("href")).toBe(
      "/pr/acme/app/7",
    );
  });
});
