import { fireEvent, render, screen } from "@testing-library/react";
import { Footprints, Sparkles } from "lucide-react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { TooltipProvider } from "@/components/ui/tooltip";
import type { PaneLayout, PanelSide } from "./pane-layout";
import { PANEL_WIDTH } from "./panel-width";
import { type PaneEntry, ReviewPanel, type SideControls } from "./review-panel";
import { usePanelWidth } from "./use-panel-width";

const ENTRIES: PaneEntry[] = [
  { id: "step", label: "Step", icon: Footprints, count: null },
  { id: "chat", label: "Chat", icon: Sparkles, count: null },
];

const CONTROLS: SideControls = {
  togglePanel: vi.fn(),
  pickPane: vi.fn(),
  splitPane: vi.fn(),
  closePane: vi.fn(),
  dropPane: vi.fn(),
};

function SidePanel({ side, panes }: { side: PanelSide; panes: PaneLayout }) {
  const sizing = usePanelWidth(side, 0);
  return (
    <ReviewPanel
      side={side}
      entries={ENTRIES}
      panes={panes}
      controls={CONTROLS}
      sizing={sizing}
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
