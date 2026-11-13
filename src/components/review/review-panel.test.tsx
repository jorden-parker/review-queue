import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { TooltipProvider } from "@/components/ui/tooltip";
import { PANE_SIDES, type PaneLayout, type PanelSide } from "./pane-layout";
import { PANEL_WIDTH } from "./panel-width";
import { type PaneEntry, ReviewPanel, type SideControls } from "./review-panel";
import { usePanelWidth } from "./use-panel-width";

const ENTRIES: PaneEntry[] = [
  { id: "path", label: "Path", count: null },
  { id: "notes", label: "Notes", count: 2 },
  { id: "github", label: "GitHub", count: null },
  { id: "step", label: "Step", count: null },
  { id: "hotspots", label: "Hotspots", count: 1 },
  { id: "chat", label: "Chat", count: null },
];

const CONTROLS: SideControls = {
  togglePanel: vi.fn(),
  pickPane: vi.fn(),
  splitPane: vi.fn(),
  showPane: vi.fn(),
  closePane: vi.fn(),
  dropPane: vi.fn(),
};

function SidePanel({ side, panes }: { side: PanelSide; panes: PaneLayout }) {
  const sizing = usePanelWidth(side, 0);
  return (
    <ReviewPanel
      side={side}
      entries={ENTRIES.filter((entry) => PANE_SIDES[entry.id] === side)}
      panes={panes}
      controls={CONTROLS}
      sizing={sizing}
      more={side === "right" ? { entries: ENTRIES, open: panes } : undefined}
      renderPane={() => ({ body: <pre data-testid="code">const longLine = 1;</pre> })}
    />
  );
}

function renderPanel(side: PanelSide = "right", panes: PaneLayout = ["step"]) {
  render(<SidePanel side={side} panes={panes} />, { wrapper: TooltipProvider });
  return screen.getByRole("separator", { name: "Resize panel" });
}

function panelWidth(): string {
  return screen.getByTestId("pane-column").style.width;
}

function overflowCodeBy(pixels: number) {
  const code = screen.getByTestId("code");
  Object.defineProperty(code, "scrollWidth", { configurable: true, value: 300 + pixels });
  Object.defineProperty(code, "clientWidth", { configurable: true, value: 300 });
}

describe("ReviewPanel resizing", () => {
  beforeEach(() => {
    window.localStorage.clear();
    Object.defineProperty(window, "innerWidth", { configurable: true, value: 1600 });
  });

  it("starts at the default width", () => {
    const handle = renderPanel();
    expect(panelWidth()).toBe(`${PANEL_WIDTH.default}px`);
    expect(handle.getAttribute("aria-valuenow")).toBe(String(PANEL_WIDTH.default));
  });

  it("widens a right panel with the left arrow key", () => {
    const handle = renderPanel();
    fireEvent.keyDown(handle, { key: "ArrowLeft" });
    expect(panelWidth()).toBe(`${PANEL_WIDTH.default + 16}px`);
  });

  it("widens a left panel with the right arrow key", () => {
    const handle = renderPanel("left", ["chat"]);
    fireEvent.keyDown(handle, { key: "ArrowRight" });
    expect(panelWidth()).toBe(`${PANEL_WIDTH.default + 16}px`);
  });

  it("widens to show overflowing code on double-click, then returns to the default", () => {
    const handle = renderPanel();
    overflowCodeBy(200);
    fireEvent.doubleClick(handle);
    expect(panelWidth()).toBe(`${PANEL_WIDTH.default + 200}px`);
    overflowCodeBy(0);
    fireEvent.doubleClick(handle);
    expect(panelWidth()).toBe(`${PANEL_WIDTH.default}px`);
  });

  it("follows the pointer while dragging", () => {
    const handle = renderPanel();
    handle.setPointerCapture = vi.fn();
    fireEvent.pointerDown(handle, { button: 0, clientX: 1000, pointerId: 1 });
    fireEvent.pointerMove(handle, { clientX: 900, pointerId: 1 });
    fireEvent.pointerUp(handle, { pointerId: 1 });
    expect(panelWidth()).toBe(`${PANEL_WIDTH.default + 100}px`);
  });

  it("remembers the width for next time", () => {
    const handle = renderPanel();
    fireEvent.keyDown(handle, { key: "ArrowLeft", shiftKey: true });
    expect(window.localStorage.getItem("review-queue:panel-width")).toBe(
      String(PANEL_WIDTH.default + 64),
    );
  });

  it("remembers a left panel's width under its own key", () => {
    const handle = renderPanel("left", ["chat"]);
    fireEvent.keyDown(handle, { key: "ArrowRight", shiftKey: true });
    expect(window.localStorage.getItem("review-queue:panel-width:left")).toBe(
      String(PANEL_WIDTH.default + 64),
    );
  });
});

describe("ReviewPanel sides", () => {
  beforeEach(() => {
    window.localStorage.clear();
    Object.defineProperty(window, "innerWidth", { configurable: true, value: 1600 });
  });

  it("labels the left side as the discussion panel", () => {
    renderPanel("left", ["chat"]);
    const aside = screen.getByRole("complementary", { name: "Discuss panel" });
    expect(aside.getAttribute("data-side")).toBe("left");
  });

  it("labels the right side as the review panel", () => {
    renderPanel("right", ["step"]);
    const aside = screen.getByRole("complementary", { name: "Review panel" });
    expect(aside.getAttribute("data-side")).toBe("right");
  });

  it("accepts a pane dragged from its own side", () => {
    renderPanel("left", ["chat"]);
    const aside = screen.getByRole("complementary", { name: "Discuss panel" });
    const accepted = fireEvent.dragOver(aside, {
      dataTransfer: { types: ["application/x-review-pane-left"] },
    });
    expect(accepted).toBe(false);
  });

  it("ignores a pane dragged from the other side", () => {
    renderPanel("left", ["chat"]);
    const aside = screen.getByRole("complementary", { name: "Discuss panel" });
    const accepted = fireEvent.dragOver(aside, {
      dataTransfer: { types: ["application/x-review-pane-right"] },
    });
    expect(accepted).toBe(true);
  });
});

describe("ReviewPanel tabs and More panes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
    Object.defineProperty(window, "innerWidth", { configurable: true, value: 1600 });
  });

  it("shows Path, Notes and GitHub as labelled tabs with the note count", () => {
    renderPanel("right", ["path"]);
    const tablist = screen.getByRole("tablist");
    expect(
      within(tablist)
        .getAllByRole("tab")
        .map((tab) => tab.getAttribute("aria-label")),
    ).toEqual(["Path", "Notes (2)", "GitHub"]);
  });

  it("selects the open primary tab and no other", () => {
    renderPanel("right", ["notes"]);
    expect(screen.getByRole("tab", { name: "Notes (2)" }).getAttribute("aria-selected")).toBe(
      "true",
    );
    expect(screen.getByRole("tab", { name: "Path" }).getAttribute("aria-selected")).toBe("false");
  });

  it("has no tabs on the discussion side", () => {
    renderPanel("left", ["chat"]);
    expect(screen.queryByRole("tablist")).toBeNull();
  });

  it("shows a tab's pane in place of the open pane on click", () => {
    renderPanel("right", ["path"]);
    fireEvent.click(screen.getByRole("tab", { name: "GitHub" }));
    expect(CONTROLS.showPane).toHaveBeenCalledWith("github");
  });

  it("splits a tab's pane with shift-click", () => {
    renderPanel("right", ["path"]);
    fireEvent.click(screen.getByRole("tab", { name: "GitHub" }), { shiftKey: true });
    expect(CONTROLS.splitPane).toHaveBeenCalledWith("github");
  });

  it("leaves an open tab alone when clicked, rather than closing it", () => {
    renderPanel("right", ["path"]);
    fireEvent.click(screen.getByRole("tab", { name: "Path" }));
    fireEvent.click(screen.getByRole("tab", { name: "Path" }), { shiftKey: true });
    expect(CONTROLS.showPane).not.toHaveBeenCalled();
    expect(CONTROLS.splitPane).not.toHaveBeenCalled();
  });

  it("moves between tabs with the arrow keys, wrapping at the ends", () => {
    renderPanel("right", ["path"]);
    fireEvent.keyDown(screen.getByRole("tab", { name: "Path" }), { key: "ArrowRight" });
    expect(CONTROLS.showPane).toHaveBeenLastCalledWith("notes");
    fireEvent.keyDown(screen.getByRole("tab", { name: "Path" }), { key: "ArrowLeft" });
    expect(CONTROLS.showPane).toHaveBeenLastCalledWith("github");
  });

  it("gives the focused tab a roving tab stop", () => {
    renderPanel("right", ["notes"]);
    expect(screen.getByRole("tab", { name: "Notes (2)" }).tabIndex).toBe(0);
    expect(screen.getByRole("tab", { name: "Path" }).tabIndex).toBe(-1);
    expect(screen.getByRole("tab", { name: "GitHub" }).tabIndex).toBe(-1);
  });

  it("lists the other panes in More with their shortcut keys", async () => {
    const user = userEvent.setup();
    renderPanel("right", ["path"]);
    await user.click(screen.getByRole("button", { name: "More panes" }));
    const more = screen.getByRole("dialog", { name: "More panes" });
    expect(within(more).queryByRole("button", { name: "Path" })).toBeNull();
    expect(
      within(within(more).getByRole("button", { name: "Hotspots (1)" })).getByText("g h"),
    ).toBeTruthy();
    expect(within(within(more).getByRole("button", { name: "Chat" })).getByText("i")).toBeTruthy();
  });

  it("lists the tabbed panes in More while the side is collapsed", async () => {
    const user = userEvent.setup();
    render(<SidePanel side="right" panes={[]} />, { wrapper: TooltipProvider });
    await user.click(screen.getByRole("button", { name: "More panes" }));
    const more = screen.getByRole("dialog", { name: "More panes" });
    expect(within(more).getByRole("button", { name: "Notes (2)" })).toBeTruthy();
    expect(within(more).getByRole("button", { name: "GitHub" })).toBeTruthy();
  });

  it("marks a More pane that is already open", async () => {
    const user = userEvent.setup();
    renderPanel("right", ["path", "hotspots"]);
    await user.click(screen.getByRole("button", { name: "More panes" }));
    const more = screen.getByRole("dialog", { name: "More panes" });
    expect(
      within(more).getByRole("button", { name: "Hotspots (1)" }).getAttribute("aria-pressed"),
    ).toBe("true");
  });

  it("opens a pane from More and closes the list", async () => {
    const user = userEvent.setup();
    renderPanel("right", ["path"]);
    await user.click(screen.getByRole("button", { name: "More panes" }));
    await user.click(screen.getByRole("button", { name: "Hotspots (1)" }));
    expect(CONTROLS.pickPane).toHaveBeenCalledWith("hotspots");
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "More panes" })).toBeNull());
  });

  it("has no More button on the discussion side", () => {
    renderPanel("left", ["chat"]);
    expect(screen.queryByRole("button", { name: "More panes" })).toBeNull();
  });
});
