import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Button } from "./button";

describe("Button", () => {
  it("deepens the solid default fill on hover", () => {
    render(<Button>Save</Button>);
    const classes = screen.getByRole("button", { name: "Save" }).classList;
    expect(classes.contains("hover:bg-primary/90")).toBe(true);
    expect(classes.contains("hover:bg-primary/80")).toBe(false);
  });

  it("presses with the calm easing and a subtle scale", () => {
    render(<Button>Save</Button>);
    const classes = screen.getByRole("button", { name: "Save" }).classList;
    expect(classes.contains("ease-calm")).toBe(true);
    expect(classes.contains("active:not-aria-[haspopup]:scale-[0.98]")).toBe(true);
    expect(classes.contains("ease-spring")).toBe(false);
  });
});
