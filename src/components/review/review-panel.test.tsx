import { fireEvent, render, screen } from "@testing-library/react";
import { Footprints } from "lucide-react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { TooltipProvider } from "@/components/ui/tooltip";
import { PANEL_WIDTH } from "./panel-width";
import { ReviewPanel } from "./review-panel";

const ENTRIES = [{ id: "step" as const, label: "Step", icon: Footprints, count: null }];

function renderPanel() {
  render(
    <ReviewPanel
      entries={ENTRIES}
      controls={{
        panes: ["step"],
        togglePanel: vi.fn(),
        pickPane: vi.fn(),
        splitPane: vi.fn(),
        closePane: vi.fn(),
        dropPane: vi.fn(),
      }}
      renderPane={() => ({ body: <pre data-testid="code">const longLine = 1;</pre> })}
    />,
    { wrapper: TooltipProvider },
  );
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

  it("widens with the left arrow key", () => {
    const handle = renderPanel();
    fireEvent.keyDown(handle, { key: "ArrowLeft" });
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
});
