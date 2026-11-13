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

  it("links each row to its pull request on GitHub outside the row link", () => {
    renderList([SESSION]);
    const link = screen.getByRole("link", { name: "Open acme/app#7 on GitHub" });
    expect(link.getAttribute("href")).toBe("https://github.com/acme/app/pull/7");
    expect(link.getAttribute("target")).toBe("_blank");
    expect(link.getAttribute("rel")).toBe("noopener noreferrer");
    expect(link.closest('a[href^="/pr/"]')).toBeNull();
  });

  it("draws the list on a hairline border rather than a ring", () => {
    const { container } = render(
      <InProgressList
        sessions={[SESSION]}
        busy={false}
        onArchive={vi.fn()}
        headingRef={createRef<HTMLHeadingElement>()}
      />,
      { wrapper: TooltipProvider },
    );
    const list = container.querySelector("ul");
    expect(list?.classList.contains("border")).toBe(true);
    expect(list?.classList.contains("ring-1")).toBe(false);
  });
});
