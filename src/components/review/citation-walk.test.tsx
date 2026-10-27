import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { Citation } from "./citations";
import { CitationChip, CitationWalk } from "./citation-walk";

const FIRST: Citation = {
  code: "src/a.ts:10",
  path: "src/a.ts",
  line: 10,
  endLine: 10,
  inDiff: true,
};
const OUTSIDE: Citation = { ...FIRST, code: "src/a.ts:90", line: 90, endLine: 90, inDiff: false };
const SECOND: Citation = { ...FIRST, code: "src/a.ts:20", line: 20, endLine: 20 };

describe("CitationChip", () => {
  it("shows the code and reports a click", () => {
    const onShow = vi.fn();
    render(<CitationChip citation={FIRST} active={false} onShow={onShow} />);
    fireEvent.click(screen.getByRole("button", { name: /src\/a\.ts:10/ }));
    expect(onShow).toHaveBeenCalledOnce();
  });

  it("is disabled with a title when its lines are not in the diff", () => {
    render(<CitationChip citation={OUTSIDE} active={false} onShow={vi.fn()} />);
    const chip = screen.getByRole("button", { name: /src\/a\.ts:90/ });
    expect(chip.hasAttribute("disabled")).toBe(true);
    expect(chip.getAttribute("title")).toBe("Not in this diff");
  });

  it("reads as a path with its line range, whatever form the model wrote", () => {
    const ranged = { ...FIRST, code: "src/a.ts#L10-L12", endLine: 12 };
    render(<CitationChip citation={ranged} active={false} onShow={vi.fn()} />);
    expect(screen.getByRole("button").textContent).toBe("src/a.ts:10-12");
  });

  it("marks the chip being walked as pressed", () => {
    render(<CitationChip citation={FIRST} active onShow={vi.fn()} />);
    expect(screen.getByRole("button", { name: /src\/a\.ts:10/ }).getAttribute("aria-pressed")).toBe(
      "true",
    );
  });
});

describe("CitationWalk", () => {
  it("stays hidden unless at least two citations are in the diff", () => {
    render(<CitationWalk citations={[FIRST, OUTSIDE]} activeIndex={null} onStep={vi.fn()} />);
    expect(screen.queryByRole("button", { name: "Next citation" })).toBeNull();
  });

  it("steps forward past citations that are not in the diff", () => {
    const onStep = vi.fn();
    render(<CitationWalk citations={[FIRST, OUTSIDE, SECOND]} activeIndex={0} onStep={onStep} />);
    fireEvent.click(screen.getByRole("button", { name: "Next citation" }));
    expect(onStep).toHaveBeenCalledWith(2);
  });

  it("steps back to the previous citation in the diff", () => {
    const onStep = vi.fn();
    render(<CitationWalk citations={[FIRST, SECOND]} activeIndex={1} onStep={onStep} />);
    fireEvent.click(screen.getByRole("button", { name: "Previous citation" }));
    expect(onStep).toHaveBeenCalledWith(0);
  });

  it("stops at both ends with disabled buttons", () => {
    const { unmount } = render(
      <CitationWalk citations={[FIRST, SECOND]} activeIndex={0} onStep={vi.fn()} />,
    );
    expect(screen.getByRole("button", { name: "Previous citation" }).hasAttribute("disabled")).toBe(
      true,
    );
    unmount();
    render(<CitationWalk citations={[FIRST, SECOND]} activeIndex={1} onStep={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Next citation" }).hasAttribute("disabled")).toBe(
      true,
    );
  });

  it("starts at the first citation when none is active", () => {
    const onStep = vi.fn();
    render(<CitationWalk citations={[FIRST, SECOND]} activeIndex={null} onStep={onStep} />);
    fireEvent.click(screen.getByRole("button", { name: "Next citation" }));
    expect(onStep).toHaveBeenCalledWith(0);
  });
});
