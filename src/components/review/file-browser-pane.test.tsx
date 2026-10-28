import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fetchSearch, fetchWorktreeFiles } from "./api";
import type { LineTarget } from "./locate";
import { FileBrowserPane } from "./file-browser-pane";

vi.mock("./api", () => ({ fetchWorktreeFiles: vi.fn(), fetchSearch: vi.fn() }));

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

  describe("Text mode", () => {
    const MATCHES = [
      { path: "src/store.ts", line: 3, text: "export function load(id: string) {" },
      { path: "src/app.ts", line: 2, text: "export const run = () => load('1');" },
    ];

    beforeEach(() => {
      vi.mocked(fetchWorktreeFiles).mockResolvedValue({ paths: PATHS });
      vi.mocked(fetchSearch).mockResolvedValue({ results: MATCHES });
    });

    afterEach(() => vi.useRealTimers());

    function typeInText(value: string) {
      fireEvent.click(screen.getByText("Text"));
      fireEvent.change(screen.getByRole("textbox", { name: "Search file text" }), {
        target: { value },
      });
    }

    it("searches the text after the typing settles", async () => {
      vi.useFakeTimers();
      renderPane();
      typeInText("load");
      expect(fetchSearch).not.toHaveBeenCalled();
      await act(async () => {
        vi.advanceTimersByTime(250);
      });
      expect(fetchSearch).toHaveBeenCalledWith(REF, "abc123", "load");
    });

    it("groups the matches by file and opens the line that is clicked", async () => {
      const { onOpen } = renderPane();
      typeInText("load");
      fireEvent.click(await screen.findByText(/load\('1'\)/));
      expect(onOpen).toHaveBeenCalledWith({ path: "src/app.ts", line: 2 });
      expect(screen.getByText("store.ts")).toBeTruthy();
      expect(screen.getByText("app.ts")).toBeTruthy();
    });

    it("says when the first 200 matches are all that is shown", async () => {
      const many = Array.from({ length: 200 }, (_, index) => ({
        path: "a.txt",
        line: index + 1,
        text: `row ${index}`,
      }));
      vi.mocked(fetchSearch).mockResolvedValue({ results: many });
      renderPane();
      typeInText("row");
      expect(await screen.findByText("Showing the first 200.")).toBeTruthy();
    });

    it("says when nothing matches", async () => {
      vi.mocked(fetchSearch).mockResolvedValue({ results: [] });
      renderPane();
      typeInText("nothing");
      expect(await screen.findByText(/No text matches/)).toBeTruthy();
    });

    it("drops a response for a query that has since changed", async () => {
      let answerStale: (value: { results: typeof MATCHES }) => void = () => undefined;
      vi.mocked(fetchSearch)
        .mockReturnValueOnce(
          new Promise((resolve) => {
            answerStale = resolve;
          }),
        )
        .mockResolvedValueOnce({ results: MATCHES });
      renderPane();
      typeInText("lo");
      await waitFor(() => expect(fetchSearch).toHaveBeenCalledTimes(1));
      fireEvent.change(screen.getByRole("textbox", { name: "Search file text" }), {
        target: { value: "load" },
      });
      expect(await screen.findByText(/load\('1'\)/)).toBeTruthy();
      await act(async () => {
        answerStale({
          results: [{ path: "stale.ts", line: 1, text: "STALE ANSWER" }],
        });
      });
      expect(screen.queryByText("STALE ANSWER")).toBeNull();
    });
  });

  it("says when the file list cannot be loaded", async () => {
    vi.mocked(fetchWorktreeFiles).mockRejectedValue(new Error("gone"));
    renderPane();
    expect(await screen.findByText("Could not list the files.")).toBeTruthy();
  });
});
