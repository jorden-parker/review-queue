import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { type DisplayHotspot, HotspotList } from "./hotspot-list";

const SWALLOWED: DisplayHotspot = {
  id: "swallowed-error:src/app.ts:42",
  rule: "swallowed-error",
  severity: "high",
  path: "src/app.ts",
  line: 42,
  title: "Error is swallowed",
  why: "The catch drops the error.",
};

function renderList(onToggleChecked = vi.fn()) {
  render(
    <HotspotList
      hotspots={[SWALLOWED]}
      checked={[]}
      onOpen={vi.fn()}
      onToggleChecked={onToggleChecked}
    />,
  );
  return onToggleChecked;
}

describe("HotspotList", () => {
  it("names the severity in words with the rule, not just a colour", () => {
    renderList();
    const label = screen.getByText("High · swallowed error");
    expect(label.querySelector("[data-icon='error']")).not.toBeNull();
  });

  it("gives each row a left border in its severity colour", () => {
    renderList();
    const row = screen.getByText("High · swallowed error").closest("li");
    expect(row?.classList.contains("border-l-4")).toBe(true);
    expect(row?.classList.contains("border-severity-high")).toBe(true);
  });

  it("ticks a hotspot off from its Checked label, which is a large hit target", async () => {
    const onToggleChecked = renderList();
    const label = screen.getByText("Checked").closest("label");
    expect(label?.className).toContain("min-h-10 min-w-10");
    await userEvent.click(screen.getByText("Checked"));
    expect(onToggleChecked).toHaveBeenCalledWith(SWALLOWED.id);
  });
});
