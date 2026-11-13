import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SkipLink } from "./skip-link";

describe("SkipLink", () => {
  it("jumps to the main content", () => {
    render(<SkipLink />);
    expect(screen.getByRole("link", { name: "Skip to content" }).getAttribute("href")).toBe(
      "#main",
    );
  });

  it("stays visually hidden until it takes focus", () => {
    render(<SkipLink />);
    const classes = screen.getByRole("link", { name: "Skip to content" }).classList;
    expect(classes.contains("sr-only")).toBe(true);
    expect(classes.contains("focus:not-sr-only")).toBe(true);
  });
});
