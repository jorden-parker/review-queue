import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { fetchWorktreeFiles } from "./api";
import type { LineTarget } from "./locate";
import { FileBrowserPane } from "./file-browser-pane";

vi.mock("./api", () => ({ fetchWorktreeFiles: vi.fn() }));

const REF = { owner: "acme", repo: "app", number: 7 };
const PATHS = ["README.md", "src/app.ts", "src/lib/store.ts"];

function renderPane(
  options: {
    inPullRequest?: (path: string) => boolean;
    onOpen?: (target: LineTarget) => void;
  } = {},
) {
  const onOpen = options.onOpen ?? vi.fn();
  const inPullRequest = options.inPullRequest ?? (() => false);
  render(
    <FileBrowserPane
      pullRequest={REF}
      headSha="abc123"
      inPullRequest={inPullRequest}
      onOpen={onOpen}
    />,
  );
  return { onOpen };
}

describe("FileBrowserPane", () => {
  it("fetches the files of the head once, for the given commit", async () => {
    vi.mocked(fetchWorktreeFiles).mockResolvedValue({ paths: PATHS });
    renderPane();
    expect(await screen.findByRole("button", { name: /README.md/ })).toBeTruthy();
    expect(fetchWorktreeFiles).toHaveBeenCalledWith(REF, "abc123");
  });

  it("shows folders collapsed until they are opened", async () => {
    vi.mocked(fetchWorktreeFiles).mockResolvedValue({ paths: PATHS });
    renderPane();
    await screen.findByRole("button", { name: /README.md/ });
    expect(screen.queryByText("app.ts")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /src/ }));
    expect(screen.getByText("app.ts")).toBeTruthy();
  });

  it("narrows the list to the paths that match the filter", async () => {
    vi.mocked(fetchWorktreeFiles).mockResolvedValue({ paths: PATHS });
    renderPane();
    await screen.findByRole("button", { name: /README.md/ });
    fireEvent.change(screen.getByRole("textbox", { name: "Filter files" }), {
      target: { value: "store" },
    });
    expect(screen.getByText("store.ts")).toBeTruthy();
    expect(screen.queryByText("README.md")).toBeNull();
  });

  it("marks files that the pull request changes", async () => {
    vi.mocked(fetchWorktreeFiles).mockResolvedValue({ paths: PATHS });
    renderPane({ inPullRequest: (path) => path === "src/app.ts" });
    await screen.findByRole("button", { name: /README.md/ });
    fireEvent.change(screen.getByRole("textbox", { name: "Filter files" }), {
      target: { value: "app" },
    });
    expect(screen.getByText("In this PR")).toBeTruthy();
  });

  it("opens the file that was clicked", async () => {
    vi.mocked(fetchWorktreeFiles).mockResolvedValue({ paths: PATHS });
    const { onOpen } = renderPane();
    fireEvent.click(await screen.findByRole("button", { name: /README.md/ }));
    expect(onOpen).toHaveBeenCalledWith({ path: "README.md", line: 1 });
  });

  it("says when the file list cannot be loaded", async () => {
    vi.mocked(fetchWorktreeFiles).mockRejectedValue(new Error("gone"));
    renderPane();
    expect(await screen.findByText("Could not list the files.")).toBeTruthy();
  });
});
