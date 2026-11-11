import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { EmptyState } from "./empty-state";

describe("EmptyState", () => {
  it("sets the emoji in a small bordered circle", () => {
    render(<EmptyState emoji="🌴">Nothing here.</EmptyState>);
    const classes = screen.getByText("🌴").classList;
    expect(classes.contains("rounded-full")).toBe(true);
    expect(classes.contains("border")).toBe(true);
    expect(classes.contains("size-12")).toBe(true);
  });
});
