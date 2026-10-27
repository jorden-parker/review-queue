import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { TooltipProvider } from "@/components/ui/tooltip";
import type { Jump } from "@/lib/session/store";
import { JumpTrail } from "./jump-trail";

const TWO_JUMPS: Jump[] = [
  { name: "parse", path: "a.ts", line: 3 },
  { name: "tokenize", path: "b.ts", line: 9 },
];

function renderTrail(jumps: Jump[], handlers = { onBack: vi.fn(), onClear: vi.fn() }) {
  render(<JumpTrail jumps={jumps} {...handlers} />, { wrapper: TooltipProvider });
  return handlers;
}

describe("JumpTrail", () => {
  it("renders nothing without jumps", () => {
    renderTrail([]);

    expect(screen.queryByRole("status")).toBeNull();
  });

  it("offers a back button to the latest jump without the long trail sentence", () => {
    renderTrail(TWO_JUMPS);

    expect(screen.getByRole("button", { name: "Back to tokenize" })).toBeTruthy();
    expect(screen.queryByText(/jumps deep/)).toBeNull();
  });

  it("calls onBack from the back button and onClear from the close button", async () => {
    const handlers = renderTrail(TWO_JUMPS);
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: "Back to tokenize" }));
    await user.click(screen.getByRole("button", { name: "Forget trail" }));

    expect(handlers.onBack).toHaveBeenCalledTimes(1);
    expect(handlers.onClear).toHaveBeenCalledTimes(1);
  });

  it("announces itself politely to screen readers", () => {
    renderTrail(TWO_JUMPS);

    expect(screen.getByRole("status")).toBeTruthy();
  });
});
