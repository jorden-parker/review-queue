import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { InboxSkeleton } from "./inbox-skeleton";

describe("InboxSkeleton", () => {
  it("draws its placeholder rows on a hairline border rather than a ring", () => {
    const { container } = render(<InboxSkeleton />);
    const list = container.querySelector("ul");
    expect(list?.classList.contains("border")).toBe(true);
    expect(list?.classList.contains("ring-1")).toBe(false);
  });
});
