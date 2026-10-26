import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ASSIST_REPLY, installFakeApi } from "@/test/fake-api";
import { emptySession, HEAD_SHA, REF, reviewPayload } from "@/test/review-fixture";
import { ReviewLoader } from "./review-loader";

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

async function renderReview(payload = reviewPayload(), orientation?: unknown) {
  const api = installFakeApi(payload, orientation);
  const user = userEvent.setup();
  render(<ReviewLoader pullRequest={REF} />, { wrapper: TooltipProvider });
  await screen.findByText(/^Step \d of 3/);
  return { api, user };
}

afterEach(() => vi.unstubAllGlobals());

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
    render(<ReviewLoader pullRequest={REF} />, { wrapper: TooltipProvider });
    expect(screen.getByText("Getting the PR ready…")).toBeTruthy();
    expect(await screen.findByText("Before you start")).toBeTruthy();
    expect(screen.getByText("Start here")).toBeTruthy();
    expect(screen.getByText("Step 1 of 3 · types · 1 lines")).toBeTruthy();
    expect(screen.getByText("≈")).toBeTruthy();
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
    await renderReview(reviewPayload(), {
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
    expect(await screen.findByText("Adds retries to loading.")).toBeTruthy();
    expect(screen.getByText("medium")).toBeTruthy();
    expect(screen.getByText(/unverified/i)).toBeTruthy();
  });

  it("opens and lists the steps in the local model's order, with its reasons", async () => {
    await renderReview(reviewPayload(), {
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
    expect(screen.getByText("Step 1 of 3 · core · 2 lines")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Start at step/ })).toBeNull();
    const reasons = [
      "The retry loop lives here.",
      "Then the options it reads.",
      "Last, the lockfile.",
    ];
    const path = within(screen.getByRole("list", { name: "Reading path" }));
    expect(path.getAllByTestId("step-reason").map((reason) => reason.textContent)).toEqual(reasons);
  });

  it("shows no steps until the local model has ordered them", async () => {
    installFakeApi(reviewPayload(), new Promise(() => {}));
    render(<ReviewLoader pullRequest={REF} />, { wrapper: TooltipProvider });
    expect(await screen.findAllByText("Local model is ordering the steps…")).toHaveLength(2);
    expect(screen.queryByRole("list", { name: "Reading path" })).toBeNull();
    expect(screen.queryByText(/^Step \d of 3/)).toBeNull();
    expect(screen.queryByRole("button", { name: /Show whole PR/ })).toBeNull();
  });

  it("falls back to the built-in order when the local model is unavailable", async () => {
    await renderReview(reviewPayload(), { status: "error", message: "connection refused" });
    expect(await screen.findByText(/connection refused/)).toBeTruthy();
    expect(screen.getByText("Step 1 of 3 · types · 1 lines")).toBeTruthy();
    expect(screen.getByText(/Built-in order/)).toBeTruthy();
  });

  it("explains the current step on request", async () => {
    const { user } = await renderReview(reviewPayload(), { status: "error", message: "x" });
    await user.click(screen.getByRole("button", { name: /Explain this step/ }));
    expect(await screen.findByText("Adds the Options type.")).toBeTruthy();
    expect(screen.getByText("Is retries optional?")).toBeTruthy();
  });

  it("hides the explain button when the model is off", async () => {
    await renderReview();
    expect(screen.queryByRole("button", { name: /Explain this step/ })).toBeNull();
  });

  it("keeps the review open when the orientation request fails", async () => {
    await renderReview(
      reviewPayload(),
      Response.json({ error: "Review is not loaded" }, { status: 409 }),
    );
    expect(await screen.findByText(/Review is not loaded/)).toBeTruthy();
    expect(screen.getByText(/^Step 1 of 3/)).toBeTruthy();
  });

  it("starts the review over after confirming, keeping notes by default", async () => {
    const payload = reviewPayload(
      emptySession({
        doneSteps: ["types:src/types.ts:0"],
        notes: [{ id: 3, path: null, line: null, kind: "parked", body: "later", createdAt: "" }],
      }),
    );
    const { api, user } = await renderReview(payload);
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
    expect(await screen.findByText("Step 2 of 3 · core · 2 lines")).toBeTruthy();
    expect(api.actions()).toEqual(
      expect.arrayContaining([
        { type: "step-done", stepId: "types:src/types.ts:0", done: true },
        { type: "current-step", stepId: "core:src/client.ts:0", headSha: HEAD_SHA },
      ]),
    );
  });

  it("keeps a compact orientation pinned after the review starts", async () => {
    const { user } = await renderReview();
    expect(screen.getByText(/Retries failed loads/)).toBeTruthy();
    await user.click(screen.getByRole("button", { name: /Done, next step/ }));
    await screen.findByText("Step 2 of 3 · core · 2 lines");
    expect(screen.getByText("≈")).toBeTruthy();
    expect(screen.queryByText(/Retries failed loads/)).toBeNull();
    await user.click(screen.getByRole("button", { name: "Show details" }));
    expect(screen.getByText(/Retries failed loads/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Hide details" })).toBeTruthy();
  });

  it("moves between steps with the keyboard and toggles the whole PR", async () => {
    const { user } = await renderReview();
    await user.keyboard("n");
    expect(await screen.findByText("Step 2 of 3 · core · 2 lines")).toBeTruthy();
    await user.keyboard("p");
    expect(await screen.findByText("Step 1 of 3 · types · 1 lines")).toBeTruthy();
    await user.keyboard("jk");
    await user.keyboard("a");
    expect(screen.getByText("Back to one step at a time (a)")).toBeTruthy();
    expect(screen.getByText("Collapsed: usually safe to skim. Show anyway")).toBeTruthy();
    await user.click(screen.getByText("Collapsed: usually safe to skim. Show anyway"));
    expect(screen.getByText("lock: 1")).toBeTruthy();
  });

  it("peeks a definition, jumps to it and comes back", async () => {
    const { api, user } = await renderReview(
      reviewPayload(emptySession({ currentStepId: "core:src/client.ts:0" })),
    );
    await user.click(screen.getAllByRole("button", { name: "Options" })[0]);
    const peek = await screen.findByRole("complementary", { name: "Options" });
    expect(await within(peek).findByTitle("src/types.ts")).toBeTruthy();
    expect(within(peek).getByText("type", { selector: "[data-slot=badge]" })).toBeTruthy();
    expect(within(peek).getByText("export type").closest(".code-token")).toBeTruthy();
    expect(document.querySelector(".grid-cols-workspace")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: /In this PR/ }));
    expect(await screen.findByText(/1 jump deep from/)).toBeTruthy();
    expect(screen.getByText("Step 1 of 3 · types · 1 lines")).toBeTruthy();
    await user.click(screen.getByRole("tab", { name: /References/ }));
    const reference = await screen.findByText("load(options: Options) {");
    expect(reference.closest("button")?.disabled).toBe(false);
    expect(screen.getByText("in this PR")).toBeTruthy();
    expect(screen.getByText("src/client.ts:10")).toBeTruthy();
    await user.keyboard("b");
    expect(await screen.findByText("Step 2 of 3 · core · 2 lines")).toBeTruthy();
    expect(api.actions()).toEqual(
      expect.arrayContaining([
        { type: "jump-push", name: "Options", path: "src/client.ts", line: 10 },
        { type: "jump-pop" },
      ]),
    );
    await user.keyboard("{Escape}");
    expect(screen.queryByText("src/types.ts:1 · type")).toBeNull();
  });

  it("adds a line note with the keyboard and parks a thought", async () => {
    const { api, user } = await renderReview();
    await user.keyboard("c");
    await user.click(screen.getByRole("button", { name: "Blocker" }));
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
          kind: "blocker",
          body: "Needs a default",
        },
        { type: "note-add", path: null, line: null, kind: "parked", body: "Check logging later" },
      ]),
    );
  });

  it("opens and ticks off hotspots", async () => {
    const { api, user } = await renderReview();
    await user.click(screen.getByRole("tab", { name: /Hotspots \(1\)/ }));
    await user.click(screen.getByRole("button", { name: /Debug output left in/ }));
    expect(await screen.findByText("Step 2 of 3 · core · 2 lines")).toBeTruthy();
    await user.click(screen.getByTitle("Checked"));
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

  it("finishes the review and posts selected notes", async () => {
    const payload = reviewPayload(
      emptySession({
        notes: [
          { id: 3, path: "src/client.ts", line: 11, kind: "nit", body: "rename", createdAt: "" },
        ],
      }),
    );
    const { api, user } = await renderReview(payload);
    await user.click(screen.getByRole("button", { name: /Finish/ }));
    const dialog = screen.getByRole("dialog", { name: "Finish review" });
    expect(within(dialog).getByText(/3 steps and 1 hotspot are not/)).toBeTruthy();
    await user.click(within(dialog).getByRole("button", { name: "Approve" }));
    await user.type(within(dialog).getByPlaceholderText(/Overall summary/), "Nice work");
    await user.click(within(dialog).getByRole("button", { name: /Post review/ }));
    await waitFor(() => expect(screen.queryByText("Finish review")).toBeNull());
    expect(screen.getByRole("status").textContent).toMatch(/Review posted/);
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
          { id: 3, path: "src/client.ts", line: 11, kind: "nit", body: "rename", createdAt: "" },
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
    await user.click(screen.getByText("Keyboard"));
    await user.keyboard("{Escape}");
    expect(screen.queryByText("Keyboard")).toBeNull();
  });

  it("explains selected lines in a side panel and takes a follow-up", async () => {
    const { api, user } = await renderReview(reviewPayload(), MODEL_ON);
    selectFirstLine("src/types.ts");
    const toolbar = await screen.findByRole("toolbar", { name: /selected lines/ });
    await user.click(within(toolbar).getByRole("button", { name: /Explain/ }));
    const panel = await screen.findByRole("complementary", { name: "Ask the model" });
    expect(await within(panel).findByText(ASSIST_REPLY.join(""))).toBeTruthy();
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
    expect(screen.queryByRole("complementary", { name: "Ask the model" })).toBeNull();
  });

  it("asks about a whole file from its header", async () => {
    const { api, user } = await renderReview(reviewPayload(), MODEL_ON);
    await user.click(screen.getAllByRole("button", { name: /Ask about file/ })[0]);
    const toolbar = screen.getByRole("toolbar", { name: "Ask the model about this file" });
    await user.click(within(toolbar).getByRole("button", { name: /Simplify/ }));
    const panel = await screen.findByRole("complementary", { name: "Ask the model" });
    expect(within(panel).getAllByText("Simplify this file")).toHaveLength(2);
    expect(await within(panel).findByText(ASSIST_REPLY.join(""))).toBeTruthy();
    const request = api.calls.filter((call) => call.url.includes("/assist")).at(-1)?.body;
    expect(request).toMatchObject({ action: "simplify", target: { kind: "file" } });
  });

  it("keeps each chat so it can be reopened and continued later", async () => {
    const { api, user } = await renderReview(reviewPayload(), MODEL_ON);
    selectFirstLine("src/types.ts");
    const toolbar = await screen.findByRole("toolbar", { name: /selected lines/ });
    await user.click(within(toolbar).getByRole("button", { name: /Explain/ }));
    const panel = await screen.findByRole("complementary", { name: "Ask the model" });
    await within(panel).findByText(ASSIST_REPLY.join(""));
    await waitFor(() =>
      expect(api.actions()).toContainEqual(expect.objectContaining({ type: "assist-save" })),
    );
    await user.click(within(panel).getByRole("button", { name: "Close" }));
    await user.click(screen.getByRole("tab", { name: "Chats (1)" }));
    await user.click(screen.getByRole("button", { name: /Explain these lines/ }));
    const reopened = await screen.findByRole("complementary", { name: "Ask the model" });
    expect(within(reopened).getByText(ASSIST_REPLY.join(""))).toBeTruthy();
    expect(within(reopened).getByLabelText("Ask the model")).toBeTruthy();
  });

  it("drafts a review comment and saves it as a line note", async () => {
    const { api, user } = await renderReview(reviewPayload(), MODEL_ON);
    selectFirstLine("src/types.ts");
    await user.click(await screen.findByRole("button", { name: /Comment/ }));
    const panel = await screen.findByRole("complementary", { name: "Ask the model" });
    await user.type(
      within(panel).getByPlaceholderText(/What worries you/),
      "retries unbounded{Meta>}{Enter}{/Meta}",
    );
    await user.click(await within(panel).findByRole("button", { name: "Blocker" }));
    await user.click(within(panel).getByRole("button", { name: "Save as note on L1" }));
    expect(api.actions()).toContainEqual({
      type: "note-add",
      path: "src/types.ts",
      line: 1,
      kind: "blocker",
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
