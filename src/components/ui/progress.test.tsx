import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Progress } from "./progress";

describe("Progress", () => {
  it("fills the indicator with the whimsy spectrum without endless motion", () => {
    const { container } = render(<Progress value={40} />);
    const indicator = container.querySelector('[data-slot="progress-indicator"]');
    expect(indicator).not.toBeNull();
    const classes = (indicator as HTMLElement).classList;
    expect(classes.contains("bg-whimsy")).toBe(true);
    expect(classes.contains("animate-shimmer")).toBe(false);
    expect(classes.contains("bg-primary")).toBe(false);
  });
});
