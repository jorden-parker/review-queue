import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { HotspotFlag, type HotspotFlagProps } from "./hotspot-flag";
import type { DisplayHotspot } from "./hotspot-list";

const DEBUG: DisplayHotspot = {
  id: "debug-output:src/app.ts:7",
  rule: "debug-output",
  severity: "low",
  path: "src/app.ts",
  line: 7,
  title: "Debug output left in",
  why: "Likely meant to be removed before merging.",
};

const SECRET: DisplayHotspot = {
  ...DEBUG,
  id: "hardcoded-secret:src/app.ts:7",
  rule: "hardcoded-secret",
  severity: "high",
  title: "Possible hard-coded secret",
  why: "Secrets in code end up in git history forever.",
};

function renderFlag(props: Partial<HotspotFlagProps> = {}) {
  const handlers = {
    onToggleChecked: vi.fn(),
    onAddNote: vi.fn(),
    onCheck: vi.fn(),
  };
  render(<HotspotFlag hotspots={[DEBUG, SECRET]} checked={[]} {...handlers} {...props} />);
  return handlers;
}

async function openFlag() {
  await userEvent.click(screen.getByRole("button", { name: /2 flags/ }));
}

describe("HotspotFlag", () => {
  it("shows every flag in full, most severe first", () => {
    renderFlag();
    const trigger = screen.getByRole("button", { name: /2 flags/ });
    expect(trigger.textContent).toBe(`${SECRET.title}${DEBUG.title}`);
  });

  it("marks only the checked flags as done", () => {
    renderFlag({ checked: [DEBUG.id] });
    const chips = screen
      .getByRole("button", { name: /2 flags/ })
      .querySelectorAll("[data-checked]");
    expect([...chips].map((chip) => chip.getAttribute("data-checked"))).toEqual(["false", "true"]);
  });

  it("opens the reasons and what to check for every flag", async () => {
    renderFlag();
    await openFlag();
    expect(screen.getByText(SECRET.why)).toBeTruthy();
    expect(screen.getByText(DEBUG.why)).toBeTruthy();
    expect(screen.getByText("If it is real, it needs rotating now.")).toBeTruthy();
  });

  it("shows the model's note in place of the rule's reason", async () => {
    renderFlag({ hotspots: [{ ...SECRET, note: "Only a test key." }] });
    await userEvent.click(screen.getByRole("button", { name: /1 flag/ }));
    expect(screen.getByText("Only a test key.")).toBeTruthy();
    expect(screen.queryByText(SECRET.why)).toBeNull();
  });

  it("ticks a flag off", async () => {
    const { onToggleChecked } = renderFlag();
    await openFlag();
    await userEvent.click(screen.getByRole("checkbox", { name: `Checked: ${DEBUG.title}` }));
    expect(onToggleChecked).toHaveBeenCalledWith(DEBUG.id);
  });

  it("says when every flag on the line is checked", () => {
    renderFlag({ checked: [DEBUG.id, SECRET.id] });
    expect(screen.getByRole("button", { name: /all checked/ })).toBeTruthy();
  });

  it("adds a note or asks the model about the line", async () => {
    const { onAddNote, onCheck } = renderFlag();
    await openFlag();
    await userEvent.click(screen.getByRole("button", { name: "Add a note" }));
    expect(onAddNote).toHaveBeenCalled();
    await openFlag();
    await userEvent.click(screen.getByRole("button", { name: "Ask the model" }));
    expect(onCheck).toHaveBeenCalled();
  });

  it("hides the actions that are not available", async () => {
    renderFlag({ onAddNote: null, onCheck: null });
    await openFlag();
    expect(screen.queryByRole("button", { name: "Add a note" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Ask the model" })).toBeNull();
  });
});
