import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Badge } from "./badge";

describe("Badge", () => {
  it("is fully rounded", () => {
    render(<Badge>New</Badge>);
    const classes = screen.getByText("New").classList;
    expect(classes.contains("rounded-full")).toBe(true);
    expect(classes.contains("rounded-4xl")).toBe(false);
  });
});
