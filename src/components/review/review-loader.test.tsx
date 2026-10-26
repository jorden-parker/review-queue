import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { installFakeApi } from "@/test/fake-api";
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
  render(<ReviewLoader pullRequest={REF} />);
  await screen.findByText(/^Step \d of 3/);
  return { api, user };
}

afterEach(() => vi.unstubAllGlobals());

describe("ReviewLoader", () => {
  it("shows a loading message, then the orientation and the first step", async () => {
    installFakeApi(reviewPayload());
    render(<ReviewLoader pullRequest={REF} />);
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
    render(<ReviewLoader pullRequest={REF} />);
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
        startStepId: "types:src/types.ts:0",
        startReason: "Everything uses Options.",
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

  it("explains when the local model is unavailable", async () => {
    await renderReview(reviewPayload(), { status: "error", message: "connection refused" });
    expect(await screen.findByText(/connection refused/)).toBeTruthy();
  });

  it("keeps the review open when the orientation request fails", async () => {
    await renderReview(
      reviewPayload(),
      Response.json({ error: "Review is not loaded" }, { status: 409 }),
    );
    expect(await screen.findByText(/Review is not loaded/)).toBeTruthy();
    expect(screen.getByText(/^Step 1 of 3/)).toBeTruthy();
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
    expect(await screen.findByText("src/types.ts:1 · type")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: /In this PR/ }));
    expect(await screen.findByText(/1 jump deep from/)).toBeTruthy();
    expect(screen.getByText("Step 1 of 3 · types · 1 lines")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: /References/ }));
    expect(await screen.findAllByText("src/client.ts:10")).toHaveLength(2);
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
    await user.click(screen.getByRole("button", { name: /Hotspots \(1\)/ }));
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
    render(<ReviewLoader pullRequest={REF} />);
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
    const dialog = screen.getByText("Finish review").closest("section")!;
    expect(within(dialog).getByText(/3 steps and 1 hotspot are not/)).toBeTruthy();
    await user.click(within(dialog).getByRole("button", { name: "Approve" }));
    await user.type(within(dialog).getByPlaceholderText(/Overall summary/), "Nice work");
    await user.click(within(dialog).getByRole("button", { name: /Post review/ }));
    await waitFor(() => expect(screen.queryByText("Finish review")).toBeNull());
    expect(api.calls.find((call) => call.url.endsWith("/submit"))?.body).toEqual({
      event: "APPROVE",
      summary: "Nice work",
      noteIds: [3],
      headSha: HEAD_SHA,
    });
  });

  it("shows the keyboard help", async () => {
    const { user } = await renderReview();
    await user.keyboard("?");
    expect(screen.getByText("Keyboard")).toBeTruthy();
    await user.click(screen.getByText("Keyboard"));
    await user.keyboard("{Escape}");
    expect(screen.queryByText("Keyboard")).toBeNull();
  });
});
