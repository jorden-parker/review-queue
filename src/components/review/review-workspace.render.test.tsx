import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Profiler } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TooltipProvider } from "@/components/ui/tooltip";
import type { ChangeNode } from "@/lib/types";
import { installFakeApi } from "@/test/fake-api";
import { REF, reviewPayload } from "@/test/review-fixture";
import { CodeLine } from "./code-line";
import type { PanelSide } from "./pane-layout";
import { ReviewLoader } from "./review-loader";

vi.mock("./code-line", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./code-line")>();
  return { ...actual, CodeLine: vi.fn(actual.CodeLine) };
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
  vi.mocked(CodeLine).mockClear();
  const onRender = mountReview();
  await screen.findByText(/^Step \d of 3/);
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
  return vi.mocked(CodeLine).mock.calls.length;
}

function reviewPanel(side: PanelSide = "right"): HTMLElement {
  const panel = screen
    .getAllByRole("complementary")
    .find((aside) => aside.getAttribute("data-side") === side);
  if (!panel) throw new Error(`no ${side} review panel`);
  return panel;
}

function paneButton(name: string | RegExp) {
  const matches = (["left", "right"] as const).flatMap((side) =>
    within(reviewPanel(side)).queryAllByRole("button", { name }),
  );
  if (matches.length !== 1) throw new Error(`expected one pane button named ${String(name)}`);
  return matches[0];
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
  it("a side-panel toggle renders no diff lines", async () => {
    const { user } = await renderWorkspace();
    expect(diffLineRenders()).toBeGreaterThan(0);
    vi.mocked(CodeLine).mockClear();
    await user.keyboard("]");
    expect(diffLineRenders()).toBe(0);
  });

  it("typing in a note renders no diff lines", async () => {
    const { user } = await renderWorkspace();
    await user.keyboard("c");
    vi.mocked(CodeLine).mockClear();
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
    await screen.findByText(/^Step \d of 3/);
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
    await user.click(paneButton("Map"));
    expect((await screen.findAllByText(MAP_NODE.name!)).length).toBeGreaterThan(0);
  });
});
