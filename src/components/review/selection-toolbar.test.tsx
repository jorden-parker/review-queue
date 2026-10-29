import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ASSIST_ACTION_BUTTONS } from "./assist-actions";
import { SelectionToolbar } from "./selection-toolbar";
import type { LineSelection } from "./use-line-selection";

const SELECTION: LineSelection = {
  range: { path: "src/a.ts", from: { hunk: 0, line: 0 }, to: { hunk: 0, line: 2 } },
  top: 0,
  left: 0,
};

describe("SelectionToolbar", () => {
  it("offers only Note when the model is off", () => {
    render(
      <SelectionToolbar
        selection={SELECTION}
        aiEnabled={false}
        onNote={vi.fn()}
        onAction={vi.fn()}
      />,
    );
    expect(screen.getByRole("button", { name: "Note" })).toBeTruthy();
    for (const { label } of ASSIST_ACTION_BUTTONS) {
      expect(screen.queryByRole("button", { name: label })).toBeNull();
    }
  });

  it("offers no Note button when the range cannot take a note", () => {
    render(
      <SelectionToolbar selection={SELECTION} aiEnabled={false} onNote={null} onAction={vi.fn()} />,
    );
    expect(screen.queryByRole("button", { name: "Note" })).toBeNull();
  });

  it("runs onNote when Note is clicked", async () => {
    const onNote = vi.fn();
    render(
      <SelectionToolbar
        selection={SELECTION}
        aiEnabled={false}
        onNote={onNote}
        onAction={vi.fn()}
      />,
    );
    await userEvent.setup().click(screen.getByRole("button", { name: "Note" }));
    expect(onNote).toHaveBeenCalledOnce();
  });
});
