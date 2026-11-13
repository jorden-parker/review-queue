import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Profiler, memo } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TooltipProvider } from "@/components/ui/tooltip";
import type { ChangeNode } from "@/lib/types";
import { installFakeApi } from "@/test/fake-api";
import { REF, reviewPayload } from "@/test/review-fixture";
import { CodeLineComponent } from "./code-line";
import { ReviewLoader } from "./review-loader";

vi.mock("./code-line", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./code-line")>();
  const CodeLineComponentMock = vi.fn(actual.CodeLineComponent);
  return {
    ...actual,
    CodeLineComponent: CodeLineComponentMock,
    CodeLine: memo(CodeLineComponentMock),
  };
});

const MAP_NODE: ChangeNode = {
  id: "retry-plan",
  path: "src/client.ts",
  name: "retryPlan",
  kind: "function",
  role: "core",
  line: 10,
  hunkIndexes: [0],
  stepId: "core:src/client.ts:0",
};

function mountReview(onRender = vi.fn()) {
  render(
    <Profiler id="review" onRender={onRender}>
      <ReviewLoader pullRequest={REF} />
    </Profiler>,
    { wrapper: TooltipProvider },
  );
  return onRender;
}

async function renderWorkspace(payload = reviewPayload()) {
  const api = installFakeApi(payload);
  vi.mocked(CodeLineComponent).mockClear();
  const onRender = mountReview();
  await screen.findAllByText(/^Step \d of 3/);
  await settleRequests(api.calls);
  return { api, user: userEvent.setup(), onRender };
}

async function settleRequests(calls: unknown[]) {
  let seen = -1;
  while (seen !== calls.length) {
    seen = calls.length;
    await act(() => nextTask());
    await act(() => nextFrame());
  }
  await act(() => nextFrame());
}

function nextFrame() {
  return new Promise((resolve) => requestAnimationFrame(() => resolve(undefined)));
}

function diffLineRenders() {
  return vi.mocked(CodeLineComponent).mock.calls.length;
}

async function morePane(user: ReturnType<typeof userEvent.setup>, name: string) {
  await user.click(screen.getByRole("button", { name: "More panes" }));
  return within(screen.getByRole("dialog", { name: "More panes" })).getByRole("button", { name });
}

function manyNavigableFilesPayload() {
  const payload = reviewPayload();
  const parts = Array.from({ length: 10 }, (_, index) => {
    const path = `src/part-${index}.ts`;
    return { ...payload.files[0], path, oldPath: path };
  });
  payload.files = [...payload.files, ...parts];
  payload.steps[0].files = parts.map((part) => ({ path: part.path, hunkIndexes: [0] }));
  return payload;
}

function twoHunkFirstStepPayload() {
  const payload = reviewPayload();
  const [first] = payload.files;
  payload.files[0] = {
    ...first,
    hunks: [...first.hunks, ...first.hunks],
    highlighted: [...first.highlighted, ...first.highlighted],
    additions: first.additions * 2,
  };
  payload.steps[0].files = [{ path: first.path, hunkIndexes: [0, 1] }];
  return payload;
}

function countReferenceRequests(calls: { url: string }[]) {
  return calls.filter((call) => call.url.includes("/reference-counts"));
}

function nextTask() {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

function wait(milliseconds: number) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("review workspace renders", () => {
  it("keeps the top bar pinned with a blurred background", async () => {
    await renderWorkspace();
    const topBar = screen.getByRole("link", { name: "Back to inbox" }).closest("header");
    expect(topBar?.classList.contains("sticky")).toBe(true);
    expect(topBar?.classList.contains("backdrop-blur")).toBe(true);
  });

  it("makes the main column the skip link target", async () => {
    await renderWorkspace();
    expect(document.getElementById("main")?.tagName).toBe("MAIN");
  });

  it("keeps the timer, GitHub link, start over and shortcuts in the More menu", async () => {
    const { user } = await renderWorkspace();
    expect(
      screen.getByRole("button", {
        name: "More actions: focus timer, GitHub page, start over, keyboard shortcuts",
      }),
    ).toBeTruthy();
    expect(screen.queryByRole("link", { name: "Open on GitHub" })).toBeNull();
    await user.click(screen.getByRole("button", { name: /^More actions/ }));
    const link = screen.getByRole("link", { name: "Open on GitHub" });
    expect(link.getAttribute("href")).toBe("https://github.com/acme/app/pull/7");
    expect(screen.getByRole("button", { name: /Start over/ })).toBeTruthy();
    expect(screen.getByRole("button", { name: /Keyboard shortcuts/ })).toBeTruthy();
  });

  it("keeps the focus timer running after the More menu closes", async () => {
    const { user } = await renderWorkspace();
    await user.click(screen.getByRole("button", { name: /^More actions/ }));
    await user.click(screen.getByRole("button", { name: /Focus timer/ }));
    await user.keyboard("{Escape}");
    await user.click(screen.getByRole("button", { name: /^More actions/ }));
    expect(screen.getByRole("button", { name: /Focus timer/ }).getAttribute("aria-pressed")).toBe(
      "true",
    );
  });

  it("shows the step, the steps read and the hotspots left under the top bar", async () => {
    await renderWorkspace();
    const bar = screen.getByRole("progressbar", { name: "Steps read" });
    expect(bar.getAttribute("aria-valuenow")).toBe("0");
    const header = bar.closest("header");
    expect(header).not.toBeNull();
    expect(within(header!).getByText(/^Step 1 of 3$/)).toBeTruthy();
    expect(within(header!).getByText(/hotspots? left$/)).toBeTruthy();
  });

  it("a side-panel toggle renders no diff lines", async () => {
    const { user } = await renderWorkspace();
    expect(diffLineRenders()).toBeGreaterThan(0);
    vi.mocked(CodeLineComponent).mockClear();
    await user.keyboard("]");
    expect(diffLineRenders()).toBe(0);
  });

  it("moving to the next hunk renders no diff lines", async () => {
    const { user } = await renderWorkspace(twoHunkFirstStepPayload());
    expect(diffLineRenders()).toBeGreaterThan(0);
    vi.mocked(CodeLineComponent).mockClear();
    await user.keyboard("j");
    expect(diffLineRenders()).toBe(0);
  });

  it("typing in a note renders no diff lines", async () => {
    const { user } = await renderWorkspace();
    await user.keyboard("c");
    vi.mocked(CodeLineComponent).mockClear();
    await user.type(screen.getByPlaceholderText(/What did you notice/), "abc");
    expect(diffLineRenders()).toBe(0);
  });

  it("scroll events with an unchanged text selection commit nothing", async () => {
    const { onRender } = await renderWorkspace();
    document.getSelection()!.selectAllChildren(document.querySelector("[data-line]")!);
    act(() => {
      document.dispatchEvent(new Event("scroll"));
    });
    await act(() => wait(40));
    onRender.mockClear();
    for (let count = 0; count < 10; count += 1) {
      act(() => {
        document.dispatchEvent(new Event("scroll"));
      });
      await act(() => nextTask());
    }
    await act(() => wait(40));
    expect(onRender).toHaveBeenCalledTimes(0);
  });

  it("reference counts are requested four at a time", async () => {
    const payload = manyNavigableFilesPayload();
    const api = installFakeApi(payload);
    const fetchFake = globalThis.fetch;
    let inFlight = 0;
    let peak = 0;
    vi.stubGlobal("fetch", (input: RequestInfo | URL, init?: RequestInit) => {
      const counted = String(input).includes("/reference-counts");
      if (counted) {
        inFlight += 1;
        peak = Math.max(peak, inFlight);
      }
      return fetchFake(input, init).finally(() => {
        if (counted) inFlight -= 1;
      });
    });
    mountReview();
    await screen.findAllByText(/^Step \d of 3/);
    await waitFor(() => expect(countReferenceRequests(api.calls)).toHaveLength(10));
    await waitFor(() => expect(inFlight).toBe(0));
    expect(new Set(countReferenceRequests(api.calls).map((call) => call.url)).size).toBe(10);
    expect(peak).toBeLessThanOrEqual(4);
  });

  it("the Map pane lists the change map", async () => {
    const payload = reviewPayload();
    payload.changeMap = {
      nodes: [MAP_NODE],
      edges: [],
      threads: [{ id: "retry-thread", entryId: MAP_NODE.id, nodeIds: [MAP_NODE.id], testIds: [] }],
      orphanIds: [],
    };
    const { user } = await renderWorkspace(payload);
    await user.click(await morePane(user, "Map"));
    expect((await screen.findAllByText(MAP_NODE.name!)).length).toBeGreaterThan(0);
  });

  it("warns the reader when the PR is already merged", async () => {
    const merged = reviewPayload();
    merged.pr = { ...merged.pr, state: "merged" };
    await renderWorkspace(merged);
    expect(screen.getByText(/already merged/)).toBeTruthy();
  });

  it("warns the reader when the PR was closed without merging", async () => {
    const closed = reviewPayload();
    closed.pr = { ...closed.pr, state: "closed" };
    await renderWorkspace(closed);
    expect(screen.getByText(/closed without merging/)).toBeTruthy();
  });

  it("shows no merged or closed warning on an open PR", async () => {
    await renderWorkspace();
    expect(screen.queryByText(/already merged|closed without merging/)).toBeNull();
  });
});
