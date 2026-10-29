import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { StrictMode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TooltipProvider } from "@/components/ui/tooltip";
import type { ReviewComment } from "@/lib/github/gh";
import { ASSIST_REPLY, installFakeApi, SUBMITTED_REVIEW_URL } from "@/test/fake-api";
import { emptySession, HEAD_SHA, REF, reviewPayload } from "@/test/review-fixture";
import type { PanelSide } from "./pane-layout";
import { ReviewLoader } from "./review-loader";

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

async function renderReview(
  payload = reviewPayload(),
  orientation?: unknown,
  explanations?: unknown[],
) {
  const api = installFakeApi(payload, orientation, explanations);
  const user = userEvent.setup();
  render(<ReviewLoader pullRequest={REF} />, { wrapper: TooltipProvider });
  await screen.findByText(/^Step \d of 3/);
  return { api, user };
}

const DEFAULT_VIEWPORT_WIDTH = window.innerWidth;

function setViewportWidth(width: number) {
  Object.defineProperty(window, "innerWidth", { configurable: true, value: width });
}

function setDocumentHidden(hidden: boolean) {
  Object.defineProperty(document, "hidden", { configurable: true, get: () => hidden });
  act(() => {
    document.dispatchEvent(new Event("visibilitychange"));
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
  setViewportWidth(DEFAULT_VIEWPORT_WIDTH);
  Reflect.deleteProperty(document, "hidden");
});

class DataTransferStub {
  private data = new Map<string, string>();
  effectAllowed = "all";
  get types() {
    return [...this.data.keys()];
  }
  setData(type: string, value: string) {
    this.data.set(type, value);
  }
  getData(type: string) {
    return this.data.get(type) ?? "";
  }
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

async function splitAboutPane(user: ReturnType<typeof userEvent.setup>) {
  await user.keyboard("{Shift>}");
  await user.click(paneButton("About"));
  await user.keyboard("{/Shift}");
}

function openPanes(side: PanelSide = "right") {
  return [...reviewPanel(side).querySelectorAll("[data-pane-index]")].map(
    (pane) => pane.getAttribute("aria-label") ?? pane.querySelector("section")?.ariaLabel,
  );
}

const MODEL_ON = { status: "error", message: "x" };

function selectFirstLine(path: string) {
  const row = document.querySelector(`[data-path="${path}"][data-hunk="0"][data-line="0"]`);
  const range = document.createRange();
  range.selectNodeContents(row as Node);
  const selection = document.getSelection();
  selection?.removeAllRanges();
  selection?.addRange(range);
  act(() => {
    document.dispatchEvent(new Event("selectionchange"));
  });
}

describe("ReviewLoader", () => {
  it("shows a loading message, then the orientation and the first step", async () => {
    installFakeApi(reviewPayload());
    const user = userEvent.setup();
    render(<ReviewLoader pullRequest={REF} />, { wrapper: TooltipProvider });
    expect(screen.getByText("Getting the PR ready…")).toBeTruthy();
    expect(await screen.findByText("Step 1 of 3")).toBeTruthy();
    expect(screen.getByText("types, 1 line")).toBeTruthy();
    await splitAboutPane(user);
    expect(screen.getByText("Before you start")).toBeTruthy();
    expect(screen.getByText("≈")).toBeTruthy();
    await userEvent.click(paneButton("Path"));
    expect(screen.getByText("Start here")).toBeTruthy();
  });

  it("keeps the orientation in its own About pane, opened in place of the Step pane", async () => {
    const { user } = await renderReview();
    const step = screen.getByRole("region", { name: "Step" });
    expect(within(step).queryByText("Before you start")).toBeNull();
    await user.click(paneButton("About"));
    expect(openPanes()).toEqual(["About"]);
    const about = screen.getByRole("region", { name: "About" });
    expect(within(about).getByText("Before you start")).toBeTruthy();
  });

  it("shows an error when the PR cannot load", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json({ error: "gh failed" }, { status: 502 })),
    );
    render(<ReviewLoader pullRequest={REF} />, { wrapper: TooltipProvider });
    expect(await screen.findByText("gh failed")).toBeTruthy();
  });

  it("shows the local model summary when ready", async () => {
    const { user } = await renderReview(reviewPayload(), {
      status: "ready",
      orientation: {
        model: "m",
        summary: "Adds retries to loading.",
        intent: "Loads fail on flaky networks.",
        risk: "medium",
        stepOrder: [],
        hotspotNotes: [{ id: "debug-output:src/client.ts:11", note: "Drop the log." }],
        extraHotspots: [
          { path: "src/client.ts", line: 10, title: "No backoff", why: "Hammers the server." },
        ],
      },
    });
    await splitAboutPane(user);
    expect(await screen.findByText("Adds retries to loading.")).toBeTruthy();
    expect(screen.getByText("medium")).toBeTruthy();
    expect(await screen.findAllByText(/unverified/i)).toHaveLength(2);
  });

  it("opens and lists the steps in the local model's order, with its reasons", async () => {
    const { user } = await renderReview(reviewPayload(), {
      status: "ready",
      orientation: {
        model: "m",
        summary: "Adds retries to loading.",
        intent: "Loads fail on flaky networks.",
        risk: "medium",
        stepOrder: [
          { id: "core:src/client.ts:0", why: "The retry loop lives here." },
          { id: "types:src/types.ts:0", why: "Then the options it reads." },
          { id: "generated:pnpm-lock.yaml:0", why: "Last, the lockfile." },
        ],
        hotspotNotes: [],
        extraHotspots: [],
      },
    });
    expect(screen.getByText("Step 1 of 3")).toBeTruthy();
    expect(screen.getByText("core, 2 lines")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Start at step/ })).toBeNull();
    const reasons = [
      "The retry loop lives here.",
      "Then the options it reads.",
      "Last, the lockfile.",
    ];
    await user.click(paneButton("Path"));
    const path = within(screen.getByRole("list", { name: "Reading path" }));
    expect(path.getAllByTestId("step-reason").map((reason) => reason.textContent)).toEqual(reasons);
  });

  it("shows no steps until the local model has ordered them", async () => {
    installFakeApi(reviewPayload(), new Promise(() => {}));
    render(<ReviewLoader pullRequest={REF} />, { wrapper: TooltipProvider });
    expect(await screen.findAllByText("Local model is ordering the steps…")).toHaveLength(1);
    await userEvent.click(paneButton("Path"));
    expect(screen.getAllByText("Local model is ordering the steps…")).toHaveLength(2);
    expect(screen.queryByRole("list", { name: "Reading path" })).toBeNull();
    expect(screen.queryByText(/^Step \d of 3/)).toBeNull();
    expect(screen.queryByRole("button", { name: /Show whole PR/ })).toBeNull();
  });

  it("falls back to the built-in order when the local model is unavailable", async () => {
    const { user } = await renderReview(reviewPayload(), {
      status: "error",
      message: "connection refused",
    });
    await splitAboutPane(user);
    expect(await screen.findByText(/connection refused/)).toBeTruthy();
    expect(screen.getByText("Step 1 of 3")).toBeTruthy();
    expect(screen.getByText("types, 1 line")).toBeTruthy();
    await user.click(paneButton("Path"));
    expect(screen.getByText(/Built-in order/)).toBeTruthy();
  });

  it("explains the current step without being asked", async () => {
    await renderReview(reviewPayload(), MODEL_ON);
    const rail = screen.getByRole("region", { name: "Step" });
    expect(await within(rail).findByText("Adds the Options type.")).toBeTruthy();
    expect(within(rail).getByText("Is retries optional?")).toBeTruthy();
  });

  it("asks the model more about a step check", async () => {
    const { api, user } = await renderReview(reviewPayload(), MODEL_ON);
    const rail = screen.getByRole("region", { name: "Step" });
    await user.click(
      await within(rail).findByRole("button", { name: "Ask more about: Is retries optional?" }),
    );
    const chat = await screen.findByRole("region", { name: "Ask the model" });
    expect(within(chat).getByText("Tell me more: Is retries optional?")).toBeTruthy();
    await waitFor(() =>
      expect(api.calls.filter((call) => call.url.includes("/assist")).at(-1)?.body).toMatchObject({
        action: "explain",
        target: { kind: "check", check: 0 },
        history: [],
      }),
    );
  });

  it("offers no ask-more button when the model is off", async () => {
    await renderReview();
    expect(screen.queryByRole("button", { name: /Ask more/ })).toBeNull();
  });

  it("asks for no explanation when the model is off", async () => {
    const { api } = await renderReview();
    expect(api.calls.some((call) => call.url.includes("/explanation"))).toBe(false);
  });

  it("retries a failed step explanation", async () => {
    const { user } = await renderReview(reviewPayload(), MODEL_ON, [
      { status: "error", message: "timed out" },
    ]);
    expect(await screen.findByText(/timed out/)).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByText("Adds the Options type.")).toBeTruthy();
  });

  it("keeps the review open when the orientation request fails", async () => {
    const { user } = await renderReview(
      reviewPayload(),
      Response.json({ error: "Review is not loaded" }, { status: 409 }),
    );
    await splitAboutPane(user);
    expect(await screen.findByText(/Review is not loaded/)).toBeTruthy();
    expect(screen.getByText(/^Step 1 of 3/)).toBeTruthy();
  });

  it("starts the review over after confirming, keeping notes by default", async () => {
    const payload = reviewPayload(
      emptySession({
        doneSteps: ["types:src/types.ts:0"],
        notes: [
          {
            side: "new",
            startLine: null,
            id: 3,
            path: null,
            line: null,
            kind: "parked",
            decorations: [],
            body: "later",
            createdAt: "",
          },
        ],
      }),
    );
    const { api, user } = await renderReview(payload);
    await splitAboutPane(user);
    await user.click(screen.getByRole("button", { name: "Start over" }));
    const dialog = screen.getByRole("dialog", { name: "Start this review over?" });
    expect(within(dialog).getByRole("checkbox", { name: /Also delete my 1 note/ })).toBeTruthy();
    await user.click(within(dialog).getByRole("button", { name: "Start over" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(api.actions()).toContainEqual({ type: "start-over", keepNotes: true });
    expect(await screen.findByText("Before you start")).toBeTruthy();
  });

  it("keeps progress when starting over is cancelled", async () => {
    const { api, user } = await renderReview();
    await user.click(screen.getByRole("button", { name: "Start over" }));
    await user.click(screen.getByRole("button", { name: "Keep my progress" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(api.actions()).not.toContainEqual(expect.objectContaining({ type: "start-over" }));
  });

  it("marks a step done and moves to the next one", async () => {
    const { api, user } = await renderReview();
    await user.click(screen.getByRole("button", { name: /Done, next step/ }));
    expect(await screen.findByText("Step 2 of 3")).toBeTruthy();
    expect(screen.getByText("core, 2 lines")).toBeTruthy();
    expect(api.actions()).toEqual(
      expect.arrayContaining([
        { type: "step-done", stepId: "types:src/types.ts:0", done: true },
        { type: "current-step", stepId: "core:src/client.ts:0", headSha: HEAD_SHA },
      ]),
    );
  });

  it("shows what changed since you last looked and catches up", async () => {
    const payload = {
      ...reviewPayload(emptySession({ baselineHeadSha: "4".repeat(40) })),
      reopenedStepIds: ["types:src/types.ts:0"],
    };
    const { api, user } = await renderReview(payload);
    await user.click(screen.getByRole("button", { name: "Show what changed" }));
    expect(await screen.findByText(/^Since you last looked/)).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "I've caught up" }));
    expect(api.actions()).toContainEqual({ type: "catch-up" });
    await waitFor(() => expect(screen.queryByText(/^Since you last looked/)).toBeNull());
  });

  it("notices a push when you come back after a long absence", async () => {
    const clock = vi.spyOn(Date, "now").mockReturnValue(1_000_000);
    try {
      const { api } = await renderReview();
      api.head.current = "6".repeat(40);
      setDocumentHidden(true);
      clock.mockReturnValue(1_000_000 + 6 * 60 * 1000);
      setDocumentHidden(false);
      expect(await screen.findByText(/New commits were pushed/)).toBeTruthy();
    } finally {
      clock.mockRestore();
    }
  });

  it("collapses the review panel and restores it with the toggle", async () => {
    const { user } = await renderReview();
    expect(openPanes()).toEqual(["Step"]);
    expect(paneButton("Step").getAttribute("aria-pressed")).toBe("true");
    await user.click(paneButton("Hide panel"));
    expect(openPanes()).toEqual([]);
    await user.click(paneButton("Path"));
    expect(openPanes()).toEqual(["Path"]);
    await user.keyboard("\\");
    expect(openPanes()).toEqual([]);
    await user.keyboard("\\");
    expect(openPanes()).toEqual(["Path"]);
  });

  it("opens one pane at a time and closes a pane from its icon", async () => {
    const { user } = await renderReview();
    await user.click(paneButton("Path"));
    expect(openPanes()).toEqual(["Path"]);
    expect(paneButton("Step").getAttribute("aria-pressed")).toBe("false");
    await user.click(paneButton("Path"));
    expect(openPanes()).toEqual([]);
  });

  it("splits panes with shift-click and closes each one on its own", async () => {
    const { user } = await renderReview();
    await user.keyboard("{Shift>}");
    await user.click(paneButton(/^Notes/));
    await user.click(paneButton("Path"));
    await user.keyboard("{/Shift}");
    expect(openPanes()).toEqual(["Step", "Notes", "Path"]);
    await user.click(paneButton("Close Notes"));
    expect(openPanes()).toEqual(["Step", "Path"]);
    await user.click(paneButton("Path"));
    expect(openPanes()).toEqual(["Step"]);
  });

  it("splits panes by dragging an icon onto the panel", async () => {
    vi.stubGlobal("DragEvent", class extends MouseEvent {});
    await renderReview();
    const dataTransfer = new DataTransferStub();
    fireEvent.dragStart(paneButton("Path"), { dataTransfer });
    const step = within(reviewPanel()).getByRole("region", { name: "Step" });
    vi.spyOn(step, "getBoundingClientRect").mockReturnValue(new DOMRect(0, 0, 100, 100));
    fireEvent.dragOver(step, { dataTransfer, clientY: 10 });
    fireEvent.drop(step, { dataTransfer, clientY: 10 });
    expect(openPanes()).toEqual(["Path", "Step"]);
    fireEvent.dragStart(paneButton(/^Hotspots/), { dataTransfer });
    fireEvent.drop(step, { dataTransfer, clientY: 90 });
    expect(openPanes()).toEqual(["Path", "Step", "Hotspots"]);
  });

  it("opens a chat on the Discuss side and keeps the Step pane open", async () => {
    setViewportWidth(1280);
    const { user } = await renderReview(reviewPayload(), MODEL_ON);
    selectFirstLine("src/types.ts");
    const toolbar = await screen.findByRole("toolbar", { name: /selected lines/ });
    await user.click(within(toolbar).getByRole("button", { name: /Explain/ }));
    const chat = await screen.findByRole("region", { name: "Ask the model" });
    expect(openPanes("left")).toEqual(["Ask the model"]);
    expect(openPanes("right")).toEqual(["Step"]);
    await user.click(within(chat).getByRole("button", { name: "Close" }));
    expect(openPanes("left")).toEqual([]);
  });

  it("keeps an open chat while Path opens", async () => {
    setViewportWidth(1280);
    const { user } = await renderReview(reviewPayload(), MODEL_ON);
    selectFirstLine("src/types.ts");
    const toolbar = await screen.findByRole("toolbar", { name: /selected lines/ });
    await user.click(within(toolbar).getByRole("button", { name: /Explain/ }));
    await screen.findByRole("region", { name: "Ask the model" });
    await user.click(paneButton("Path"));
    expect(screen.getByRole("region", { name: "Ask the model" })).toBeTruthy();
    expect(openPanes("right")).toEqual(["Path"]);
  });

  it("opens Path in place of the chat when both sides do not fit", async () => {
    setViewportWidth(1100);
    const { user } = await renderReview(reviewPayload(), MODEL_ON);
    selectFirstLine("src/types.ts");
    const toolbar = await screen.findByRole("toolbar", { name: /selected lines/ });
    await user.click(within(toolbar).getByRole("button", { name: /Explain/ }));
    await screen.findByRole("region", { name: "Ask the model" });
    await user.click(paneButton("Path"));
    expect(openPanes("left")).toEqual([]);
    expect(openPanes("right")).toEqual(["Path"]);
  });

  it("keeps a split when a peek opens a Context pane that is already open", async () => {
    const { user } = await renderReview(
      reviewPayload(emptySession({ currentStepId: "core:src/client.ts:0" })),
    );
    await user.keyboard("{Shift>}");
    await user.click(paneButton("Chats"));
    await user.click(paneButton("Context"));
    await user.keyboard("{/Shift}");
    await user.click(screen.getAllByRole("button", { name: "Options" })[0]);
    expect(await screen.findByRole("region", { name: "Options" })).toBeTruthy();
    expect(openPanes("left")).toEqual(["Chats", "Context"]);
  });

  it("opens the hidden panel when a chat starts", async () => {
    const { user } = await renderReview(reviewPayload(), MODEL_ON);
    await user.click(screen.getByRole("button", { name: "Hide panel" }));
    selectFirstLine("src/types.ts");
    const toolbar = await screen.findByRole("toolbar", { name: /selected lines/ });
    await user.click(within(toolbar).getByRole("button", { name: /Explain/ }));
    expect(await screen.findByRole("region", { name: "Ask the model" })).toBeTruthy();
  });

  it("keeps a compact orientation pinned after the review starts", async () => {
    const { user } = await renderReview();
    await splitAboutPane(user);
    expect(screen.getByText(/Retries failed loads/)).toBeTruthy();
    await user.click(screen.getByRole("button", { name: /Done, next step/ }));
    await screen.findByText("Step 2 of 3");
    expect(screen.getByText("core, 2 lines")).toBeTruthy();
    expect(screen.getByText("≈")).toBeTruthy();
    expect(screen.queryByText(/Retries failed loads/)).toBeNull();
    await user.click(screen.getByRole("button", { name: "Show details" }));
    expect(screen.getByText(/Retries failed loads/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Hide details" })).toBeTruthy();
  });

  it("moves between steps with the keyboard and toggles the whole PR", async () => {
    const { user } = await renderReview();
    await user.keyboard("n");
    expect(await screen.findByText("Step 2 of 3")).toBeTruthy();
    expect(screen.getByText("core, 2 lines")).toBeTruthy();
    await user.keyboard("p");
    expect(await screen.findByText("Step 1 of 3")).toBeTruthy();
    expect(screen.getByText("types, 1 line")).toBeTruthy();
    await user.keyboard("jk");
    await user.keyboard("a");
    expect(screen.getByText("Back to one step at a time")).toBeTruthy();
    expect(screen.getByText("Collapsed: usually safe to skim. Show anyway")).toBeTruthy();
    await user.click(screen.getByText("Collapsed: usually safe to skim. Show anyway"));
    expect(screen.getByText("lock: 1")).toBeTruthy();
  });

  it("peeks a definition, jumps to it and comes back", async () => {
    const { api, user } = await renderReview(
      reviewPayload(emptySession({ currentStepId: "core:src/client.ts:0" })),
    );
    await user.click(screen.getByRole("button", { name: "Hide panel" }));
    await user.click(screen.getAllByRole("button", { name: "Options" })[0]);
    const contextPanel = await screen.findByRole("region", { name: "Context" });
    const peek = within(contextPanel).getByRole("region", { name: "Options" });
    expect(await within(peek).findByTitle("src/types.ts")).toBeTruthy();
    expect(within(peek).getByText("type", { selector: "[data-slot=badge]" })).toBeTruthy();
    expect(within(peek).getByText("export type").closest(".code-token")).toBeTruthy();
    expect(document.querySelector(".grid-cols-workspace")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: /In this PR/ }));
    expect(await screen.findByRole("button", { name: /Back to Options/ })).toBeTruthy();
    expect(screen.getByText("1 of 3")).toBeTruthy();
    await user.click(screen.getByRole("tab", { name: /References/ }));
    const reference = await screen.findByText("load(options: Options) {");
    expect(reference.closest("button")?.disabled).toBe(false);
    expect(screen.getByText("in this PR")).toBeTruthy();
    await user.hover(screen.getByRole("button", { name: /Back to Options/ }));
    expect(await screen.findAllByText("src/client.ts:10")).toBeTruthy();
    await user.keyboard("b");
    expect(await screen.findByText("2 of 3")).toBeTruthy();
    expect(api.actions()).toEqual(
      expect.arrayContaining([
        { type: "jump-push", name: "Options", path: "src/client.ts", line: 10 },
        { type: "jump-pop" },
      ]),
    );
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("region", { name: "Options" })).toBeNull();
    expect(within(contextPanel).getByRole("button", { name: "Open Options" })).toBeTruthy();
  });

  it("remembers peeked names in the Context tab and pins them", async () => {
    const { api, user } = await renderReview(
      reviewPayload(emptySession({ currentStepId: "core:src/client.ts:0" })),
    );
    await user.click(screen.getAllByRole("button", { name: "Options" })[0]);
    const peek = await screen.findByRole("region", { name: "Options" });
    await user.click(await within(peek).findByRole("button", { name: "Pin" }));
    expect(within(peek).getByRole("button", { name: "Unpin" })).toBeTruthy();
    await user.keyboard("{Escape}gc");
    expect(await screen.findByRole("button", { name: "Open Options" })).toBeTruthy();
    expect(screen.getByText("type Options = { retries: number }")).toBeTruthy();
    const contextTab = paneButton("Context (1)");
    expect(within(contextTab).getByText("Context")).toBeTruthy();
    expect(within(contextTab).getByText("1")).toBeTruthy();
    expect(api.actions()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: "symbol-seen" }),
        expect.objectContaining({ type: "symbol-pin", pinned: true }),
      ]),
    );
  });

  it("shows how often a changed declaration is referenced and lists the references", async () => {
    const { api, user } = await renderReview(
      reviewPayload(emptySession({ currentStepId: "core:src/client.ts:0" })),
    );
    await user.click(await screen.findByRole("button", { name: "2 references to load" }));
    expect(await screen.findByText("load(options: Options) {")).toBeTruthy();
    expect(api.calls.map((call) => call.url)).toContainEqual(
      expect.stringContaining("/references?sha=5555"),
    );
    expect(api.calls.map((call) => call.url)).toContainEqual(
      expect.stringContaining("name=load&path=src%2Fclient.ts&line=10&character=16&side=new"),
    );
  });

  it("outlines the step's files and goes to a symbol or peeks one outside the diff", async () => {
    const { user } = await renderReview(
      reviewPayload(emptySession({ currentStepId: "core:src/client.ts:0" })),
    );
    await user.keyboard("go");
    const outline = await screen.findByRole("region", { name: "Outline" });
    await user.click(await within(outline).findByRole("button", { name: "Collapse load" }));
    expect(within(outline).queryByRole("button", { name: /attempts/ })).toBeNull();
    await user.click(within(outline).getByRole("button", { name: "Expand load" }));
    await user.click(within(outline).getByRole("button", { name: /^load/ }));
    const landed = document.querySelector("[aria-current=location]");
    expect(landed?.getAttribute("id")).toBe("line-src/client.ts-10");
    await user.click(within(outline).getByRole("button", { name: /^retry/ }));
    expect(await screen.findByRole("region", { name: "Context" })).toBeTruthy();
  });

  it("marks a line that has a GitHub thread and opens the conversation from it", async () => {
    const thread: ReviewComment = {
      id: 1,
      inReplyTo: null,
      path: "src/types.ts",
      line: 1,
      side: "RIGHT",
      author: "sam",
      body: "Should this be exported?",
      url: "https://github.com/acme/app/pull/7#discussion_r1",
      createdAt: "2026-10-01T10:00:00Z",
    };
    installFakeApi(reviewPayload(), undefined, undefined, undefined, {
      comments: [thread],
      reviews: [],
      truncated: false,
      viewer: null,
    });
    const user = userEvent.setup();
    render(<ReviewLoader pullRequest={REF} />, { wrapper: TooltipProvider });
    await screen.findByText(/^Step \d of 3/);
    await user.click(await screen.findByRole("button", { name: "Show 1 GitHub thread" }));
    expect(await screen.findByText("Should this be exported?")).toBeTruthy();
  });

  it("adds a line note with the keyboard and parks a thought", async () => {
    const { api, user } = await renderReview();
    await user.keyboard("c");
    await user.click(screen.getByRole("button", { name: "Issue" }));
    await user.click(screen.getByRole("button", { name: "blocking" }));
    await user.type(screen.getByPlaceholderText(/What did you notice/), "Needs a default");
    await user.click(screen.getByRole("button", { name: "Save note" }));
    expect(await screen.findByText("Needs a default")).toBeTruthy();
    await user.keyboard("P");
    const parking = await screen.findByPlaceholderText(/Park it here/);
    await waitFor(() => expect(document.activeElement).toBe(parking));
    await user.type(parking, "Check logging later{Enter}");
    expect(await screen.findByText("Check logging later")).toBeTruthy();
    expect(api.actions()).toEqual(
      expect.arrayContaining([
        {
          type: "note-add",
          path: "src/types.ts",
          line: 1,
          side: "new",
          startLine: null,
          kind: "issue",
          decorations: ["blocking"],
          body: "Needs a default",
        },
        {
          type: "note-add",
          path: null,
          line: null,
          side: "new",
          startLine: null,
          kind: "parked",
          decorations: [],
          body: "Check logging later",
        },
      ]),
    );
  });

  it("keeps a refused note out of the review and says why", async () => {
    const { api, user } = await renderReview();
    api.refuseNextSessionAction("Note body is too long");
    await user.keyboard("c");
    await user.click(screen.getByRole("button", { name: "Issue" }));
    await user.type(screen.getByPlaceholderText(/What did you notice/), "Needs a default");
    await user.click(screen.getByRole("button", { name: "Save note" }));
    expect(await screen.findByText("Couldn't save: Note body is too long")).toBeTruthy();
    expect(screen.queryByText("Needs a default")).toBeNull();
  });

  it("offers every label and keeps a non-blocking decoration with its hint", async () => {
    const { api, user } = await renderReview();
    await user.keyboard("c");
    await user.click(screen.getByRole("button", { name: "Suggestion" }));
    expect(screen.getByText("A proposed improvement. Say what and why.")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "blocking" }));
    await user.click(screen.getByRole("button", { name: "non-blocking" }));
    await user.type(screen.getByPlaceholderText(/What did you notice/), "Extract a helper");
    await user.click(screen.getByRole("button", { name: "Save note" }));
    expect(await screen.findByText("Extract a helper")).toBeTruthy();
    expect(api.actions()).toContainEqual({
      type: "note-add",
      path: "src/types.ts",
      line: 1,
      side: "new",
      startLine: null,
      kind: "suggestion",
      decorations: ["non-blocking"],
      body: "Extract a helper",
    });
  });

  it("opens and ticks off hotspots", async () => {
    const { api, user } = await renderReview();
    await user.click(paneButton(/Hotspots \(1\)/));
    await user.click(screen.getByRole("button", { name: /Debug output left in/ }));
    await user.click(paneButton("Step"));
    expect(await screen.findByText("Step 2 of 3")).toBeTruthy();
    expect(screen.getByText("core, 2 lines")).toBeTruthy();
    const stepHotspots = screen.getByRole("region", { name: "Hotspots in this step" });
    await user.click(within(stepHotspots).getByTitle("Checked"));
    expect(api.actions()).toContainEqual({
      type: "hotspot-checked",
      hotspotId: "debug-output:src/client.ts:11",
      checked: true,
    });
  });

  it("pauses with a note and welcomes you back with it", async () => {
    const { api, user } = await renderReview();
    await user.keyboard(".");
    const input = screen.getByPlaceholderText(/check the retry loop/);
    await user.type(input, "look at Options next");
    await user.click(within(input.closest("form")!).getByRole("button", { name: "Pause" }));
    expect(api.actions()).toContainEqual({ type: "pause", note: "look at Options next" });

    act(() => {
      Object.defineProperty(document, "hidden", { configurable: true, value: true });
      document.dispatchEvent(new Event("visibilitychange"));
    });
    vi.spyOn(Date, "now").mockReturnValue(Date.now() + 10 * 60 * 1000);
    act(() => {
      Object.defineProperty(document, "hidden", { configurable: true, value: false });
      document.dispatchEvent(new Event("visibilitychange"));
    });
    vi.restoreAllMocks();
    expect(await screen.findByText("Welcome back")).toBeTruthy();
    expect(screen.getByText("look at Options next")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: /Continue/ }));
    expect(api.actions()).toContainEqual({ type: "resume" });
  });

  it("greets with reopened steps after new commits", async () => {
    const payload = reviewPayload(emptySession({ doneSteps: ["types:src/types.ts:0"] }));
    installFakeApi({ ...payload, reopenedStepIds: ["core:src/client.ts:0"] });
    render(<ReviewLoader pullRequest={REF} />, { wrapper: TooltipProvider });
    expect(await screen.findByText("Welcome back")).toBeTruthy();
    expect(screen.getByText(/New commits changed 1 step/)).toBeTruthy();
  });

  it("posts the seen request once per load, even when React runs effects twice", async () => {
    const api = installFakeApi(reviewPayload());
    render(
      <StrictMode>
        <ReviewLoader pullRequest={REF} />
      </StrictMode>,
      { wrapper: TooltipProvider },
    );
    expect(await screen.findByText("Step 1 of 3")).toBeTruthy();
    expect(api.calls.filter((call) => call.url.includes("/seen"))).toHaveLength(1);
  });

  it("finishes the review and posts selected notes", async () => {
    const payload = reviewPayload(
      emptySession({
        notes: [
          {
            side: "new",
            startLine: null,
            id: 3,
            path: "src/client.ts",
            line: 11,
            kind: "nitpick",
            decorations: [],
            body: "rename",
            createdAt: "",
          },
        ],
      }),
    );
    const { api, user } = await renderReview(payload);
    await user.click(screen.getByRole("button", { name: /Finish/ }));
    const dialog = screen.getByRole("dialog", { name: "Finish review" });
    expect(within(dialog).getByText(/3 steps and 1 hotspot are not/)).toBeTruthy();
    await user.click(within(dialog).getByRole("button", { name: "Approve" }));
    await user.type(within(dialog).getByPlaceholderText(/Overall summary/), "Nice work");
    await user.click(within(dialog).getByRole("button", { name: /Approve on GitHub/ }));
    await waitFor(() => expect(screen.queryByText("Finish review")).toBeNull());
    expect(screen.getByRole("status").textContent).toMatch(/Review posted/);
    expect(screen.getByRole("link", { name: "Open it" }).getAttribute("href")).toBe(
      SUBMITTED_REVIEW_URL,
    );
    expect(api.calls.find((call) => call.url.endsWith("/submit"))?.body).toEqual({
      event: "APPROVE",
      summary: "Nice work",
      noteIds: [3],
      headSha: HEAD_SHA,
    });
  });

  it("drafts the summary from notes", async () => {
    const payload = reviewPayload(
      emptySession({
        notes: [
          {
            side: "new",
            startLine: null,
            id: 3,
            path: "src/client.ts",
            line: 11,
            kind: "nitpick",
            decorations: [],
            body: "rename",
            createdAt: "",
          },
        ],
      }),
    );
    const { user } = await renderReview(payload, { status: "error", message: "x" });
    await user.click(screen.getByRole("button", { name: /Finish/ }));
    const dialog = screen.getByRole("dialog", { name: "Finish review" });
    await user.click(within(dialog).getByRole("button", { name: /Draft from my notes/ }));
    await waitFor(() =>
      expect(within(dialog).getByPlaceholderText(/Overall summary/)).toHaveProperty(
        "value",
        "Looks good overall; one question on retries.",
      ),
    );
  });

  it("has no draft button when the model is off", async () => {
    const { user } = await renderReview();
    await user.click(screen.getByRole("button", { name: /Finish/ }));
    const dialog = screen.getByRole("dialog", { name: "Finish review" });
    expect(within(dialog).queryByRole("button", { name: /Draft from my notes/ })).toBeNull();
  });

  it("shows the keyboard help", async () => {
    const { user } = await renderReview();
    await user.keyboard("?");
    expect(screen.getByText("Keyboard")).toBeTruthy();
    expect(screen.getByText("Hotspots: things to check in this PR")).toBeTruthy();
    expect(screen.getByText("GitHub: the PR's comments and what you posted")).toBeTruthy();
    await user.click(screen.getByText("Keyboard"));
    await user.keyboard("{Escape}");
    expect(screen.queryByText("Keyboard")).toBeNull();
  });

  it("opens the Hotspots and GitHub panes from the keyboard", async () => {
    const { user } = await renderReview();
    await user.keyboard("gh");
    expect(openPanes()).toEqual(["Hotspots"]);
    await user.keyboard("gg");
    expect(openPanes()).toEqual(["GitHub"]);
  });

  it("explains selected lines in a side panel and takes a follow-up", async () => {
    setViewportWidth(1280);
    const { api, user } = await renderReview(reviewPayload(), MODEL_ON);
    selectFirstLine("src/types.ts");
    const toolbar = await screen.findByRole("toolbar", { name: /selected lines/ });
    await user.click(within(toolbar).getByRole("button", { name: /Explain/ }));
    const panel = await screen.findByRole("region", { name: "Ask the model" });
    expect(await within(panel).findByText(ASSIST_REPLY.join(""))).toBeTruthy();
    expect(openPanes("right")).toEqual(["Step"]);
    await user.click(within(panel).getByRole("button", { name: "src/types.ts L1" }));
    await user.type(
      within(panel).getByLabelText("Ask the model"),
      "Why a number?{Meta>}{Enter}{/Meta}",
    );
    await waitFor(() =>
      expect(api.calls.filter((call) => call.url.includes("/assist")).at(-1)?.body).toMatchObject({
        action: "explain",
        target: { kind: "lines", range: { path: "src/types.ts" } },
        history: [
          { role: "assistant", content: ASSIST_REPLY.join("") },
          { role: "user", content: "Why a number?" },
        ],
      }),
    );
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("region", { name: "Ask the model" })).toBeNull();
  });

  it("asks about a whole file from its header", async () => {
    const { api, user } = await renderReview(reviewPayload(), MODEL_ON);
    await user.click(screen.getAllByRole("button", { name: /Actions/ })[0]);
    const toolbar = screen.getByRole("toolbar", { name: "File actions" });
    await user.click(within(toolbar).getByRole("button", { name: /Simplify/ }));
    const panel = await screen.findByRole("region", { name: "Ask the model" });
    expect(within(panel).getAllByText("Simplify this file")).toHaveLength(2);
    expect(await within(panel).findByText(ASSIST_REPLY.join(""))).toBeTruthy();
    const request = api.calls.filter((call) => call.url.includes("/assist")).at(-1)?.body;
    expect(request).toMatchObject({ action: "simplify", target: { kind: "file" } });
  });

  it("reviews a whole file from its actions", async () => {
    const { api, user } = await renderReview(reviewPayload(), MODEL_ON);
    await user.click(screen.getAllByRole("button", { name: /Actions/ })[0]);
    const toolbar = screen.getByRole("toolbar", { name: "File actions" });
    await user.click(within(toolbar).getByRole("button", { name: /Review/ }));
    const panel = await screen.findByRole("region", { name: "Ask the model" });
    expect(within(panel).getAllByText("Review this file")).toHaveLength(2);
    const request = api.calls.filter((call) => call.url.includes("/assist")).at(-1)?.body;
    expect(request).toMatchObject({ action: "review", target: { kind: "file" } });
  });

  it("keeps each chat so it can be reopened and continued later", async () => {
    const { api, user } = await renderReview(reviewPayload(), MODEL_ON);
    selectFirstLine("src/types.ts");
    const toolbar = await screen.findByRole("toolbar", { name: /selected lines/ });
    await user.click(within(toolbar).getByRole("button", { name: /Explain/ }));
    const panel = await screen.findByRole("region", { name: "Ask the model" });
    await within(panel).findByText(ASSIST_REPLY.join(""));
    await waitFor(() =>
      expect(api.actions()).toContainEqual(expect.objectContaining({ type: "assist-save" })),
    );
    await user.click(within(panel).getByRole("button", { name: "Close" }));
    await user.click(paneButton("Chats (1)"));
    await user.click(screen.getByRole("button", { name: /Explain these lines/ }));
    const reopened = await screen.findByRole("region", { name: "Ask the model" });
    expect(within(reopened).getByText(ASSIST_REPLY.join(""))).toBeTruthy();
    expect(within(reopened).getByLabelText("Ask the model")).toBeTruthy();
  });

  it("drafts a review comment and saves it as a line note", async () => {
    const { api, user } = await renderReview(reviewPayload(), MODEL_ON);
    selectFirstLine("src/types.ts");
    await user.click(await screen.findByRole("button", { name: /Comment/ }));
    const panel = await screen.findByRole("region", { name: "Ask the model" });
    await user.type(
      within(panel).getByPlaceholderText(/What worries you/),
      "retries unbounded{Meta>}{Enter}{/Meta}",
    );
    await user.click(await within(panel).findByRole("button", { name: "Issue" }));
    await user.click(within(panel).getByRole("button", { name: "blocking" }));
    await user.click(within(panel).getByRole("button", { name: "Save as note on L1" }));
    expect(api.actions()).toContainEqual({
      type: "note-add",
      path: "src/types.ts",
      line: 1,
      side: "new",
      startLine: null,
      kind: "issue",
      decorations: ["blocking"],
      body: ASSIST_REPLY.join(""),
    });
    expect(within(panel).getByRole("button", { name: "Saved to your notes" })).toBeTruthy();
  });

  it("offers no selection toolbar when the model is off", async () => {
    await renderReview();
    selectFirstLine("src/types.ts");
    expect(screen.queryByRole("toolbar", { name: /selected lines/ })).toBeNull();
  });
});
