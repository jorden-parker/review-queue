import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { OpenPullRequestForm } from "./open-pull-request-form";

const router = vi.hoisted(() => ({ push: vi.fn() }));

vi.mock("next/navigation", () => ({ useRouter: () => router }));

async function openPullRequest(text: string) {
  const user = userEvent.setup();
  render(<OpenPullRequestForm />);
  await user.type(screen.getByLabelText("PR link or owner/repo#number"), text);
  await user.click(screen.getByRole("button", { name: "Open" }));
}

describe("OpenPullRequestForm", () => {
  afterEach(() => router.push.mockClear());

  it("opens the review page for a pasted PR link", async () => {
    await openPullRequest("https://github.com/acme/app/pull/7");
    expect(router.push).toHaveBeenCalledWith("/pr/acme/app/7");
  });

  it("opens the review page for the short owner/repo#number form", async () => {
    await openPullRequest("acme/app#7");
    expect(router.push).toHaveBeenCalledWith("/pr/acme/app/7");
  });

  it("says so and stays on the page when the text is not a PR", async () => {
    await openPullRequest("not a pull request");
    expect(screen.getByText(/look like a PR link/)).toBeTruthy();
    expect(router.push).not.toHaveBeenCalled();
  });
});
