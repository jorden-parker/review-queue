import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Kbd } from "./kbd";

describe("Kbd", () => {
  it("sets the key in the mono font with a hairline border", () => {
    render(<Kbd>K</Kbd>);
    const classes = screen.getByText("K").classList;
    expect(classes.contains("font-mono")).toBe(true);
    expect(classes.contains("border")).toBe(true);
    expect(classes.contains("font-sans")).toBe(false);
  });
});
