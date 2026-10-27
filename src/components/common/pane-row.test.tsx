import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PaneRow } from "./pane-row";

function renderRow(props: Partial<Parameters<typeof PaneRow>[0]> = {}) {
  render(
    <ul>
      <PaneRow {...props}>Row text</PaneRow>
    </ul>,
  );
  return screen.getByRole("listitem");
}

describe("PaneRow", () => {
  it("renders a list item that bleeds 8px past the pane edge and keeps its text at 16px", () => {
    const row = renderRow();
    expect(row.classList).toContain("-mx-2");
    expect(row.classList).toContain("px-2");
    expect(row.classList).toContain("rounded-lg");
  });

  it("forwards className and renders its children", () => {
    const row = renderRow({ className: "group" });
    expect(row.classList).toContain("group");
    expect(row.textContent).toBe("Row text");
  });

  it("shows the hover tint when inactive", () => {
    expect(renderRow().classList).toContain("hover:bg-muted");
  });

  it("swaps the hover tint for the accent fill when active", () => {
    const row = renderRow({ active: true });
    expect(row.classList).toContain("bg-accent");
    expect(row.classList).not.toContain("hover:bg-muted");
  });
});
