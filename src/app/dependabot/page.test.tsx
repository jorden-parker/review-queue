import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import DependabotPage from "./page";

vi.mock("@/components/inbox/dependabot-list", () => ({ DependabotList: () => null }));

describe("DependabotPage", () => {
  it("titles the page Dependabot", () => {
    render(<DependabotPage />);
    expect(screen.getByRole("heading", { name: "Dependabot" })).toBeTruthy();
  });

  it("links back to the review queue", () => {
    render(<DependabotPage />);
    expect(screen.getByRole("link", { name: /Review queue/ }).getAttribute("href")).toBe("/");
  });
});
