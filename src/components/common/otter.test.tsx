import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Otter, RainbowRule } from "./otter";

describe("Otter", () => {
  it("renders the otter hidden from assistive tech", () => {
    render(<Otter />);
    const otter = screen.getByText("🦦");
    expect(otter.getAttribute("aria-hidden")).toBe("true");
  });

  it("floats twice and wiggles on hover", () => {
    render(<Otter />);
    const classes = screen.getByText("🦦").classList;
    expect(classes.contains("animate-otter")).toBe(true);
    expect(classes.contains("hover:animate-wiggle")).toBe(true);
    expect(classes.contains("inline-block")).toBe(true);
  });

  it("adds the caller's classes", () => {
    render(<Otter className="text-4xl" />);
    expect(screen.getByText("🦦").classList.contains("text-4xl")).toBe(true);
  });
});

describe("RainbowRule", () => {
  it("draws the rainbow bar hidden from assistive tech", () => {
    const { container } = render(<RainbowRule />);
    const rule = container.firstElementChild as HTMLElement;
    expect(rule.getAttribute("aria-hidden")).toBe("true");
    expect(rule.classList.contains("rainbow-rule")).toBe(true);
  });

  it("adds the caller's classes", () => {
    const { container } = render(<RainbowRule className="fixed top-0" />);
    expect((container.firstElementChild as HTMLElement).classList.contains("fixed")).toBe(true);
  });
});
