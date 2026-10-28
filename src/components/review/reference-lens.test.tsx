import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ReferenceLens } from "./reference-lens";

const LENS = { name: "load", line: 10, character: 16 };

describe("ReferenceLens", () => {
  it("shows an exact count as before", () => {
    render(
      <ReferenceLens reference={{ ...LENS, count: 2 }} lineText="  load() {" onShow={vi.fn()} />,
    );
    expect(screen.getByRole("button", { name: "2 references to load" })).toBeTruthy();
  });

  it("shows a capped count as a lower bound", () => {
    render(
      <ReferenceLens
        reference={{ ...LENS, count: 59, capped: true }}
        lineText="  load() {"
        onShow={vi.fn()}
      />,
    );
    expect(screen.getByRole("button", { name: "59+ references to load" })).toBeTruthy();
  });
});
