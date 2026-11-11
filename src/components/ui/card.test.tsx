import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Card } from "./card";

describe("Card", () => {
  it("draws a hairline border instead of a ring", () => {
    const { container } = render(<Card>Body</Card>);
    const classes = (container.firstElementChild as HTMLElement).classList;
    expect(classes.contains("border")).toBe(true);
    expect(classes.contains("ring-1")).toBe(false);
  });

  it("has no drop shadow", () => {
    const { container } = render(<Card>Body</Card>);
    expect((container.firstElementChild as HTMLElement).classList.contains("shadow-none")).toBe(
      true,
    );
  });
});
