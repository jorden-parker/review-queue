import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { SettingsView } from "@/lib/settings/settings-service";
import { LlmSettingsForm } from "./llm-settings-form";

const VIEW: SettingsView = {
  llm: { enabled: true, model: null, thinking: true, timeoutMs: 8000 },
  models: ["qwen3-4b-cc", "granite4.2-3b-cc"],
  autoModel: "granite4.2-3b-cc",
};

type Call = { url: string; method: string; body: unknown };

function fakeFetch(answers: Record<string, unknown>) {
  const calls: Call[] = [];
  vi.stubGlobal("fetch", async (url: string, init: RequestInit = {}) => {
    const method = init.method ?? "GET";
    calls.push({ url, method, body: init.body ? JSON.parse(String(init.body)) : null });
    return Response.json(answers[`${method} ${url}`]);
  });
  return calls;
}

afterEach(() => vi.unstubAllGlobals());

describe("LlmSettingsForm", () => {
  it("offers auto, naming the model it picks, and every installed model", () => {
    render(<LlmSettingsForm initial={VIEW} />);
    const options = screen.getAllByRole("option").map((option) => option.textContent);
    expect(options).toEqual(["Auto (granite4.2-3b-cc)", "qwen3-4b-cc", "granite4.2-3b-cc"]);
  });

  it("saves the chosen model, thinking and timeout", async () => {
    const saved = { ...VIEW.llm, model: "qwen3-4b-cc", thinking: false, timeoutMs: 30_000 };
    const calls = fakeFetch({ "PUT /api/settings": { ...VIEW, llm: saved } });
    render(<LlmSettingsForm initial={VIEW} />);
    await userEvent.selectOptions(screen.getByLabelText("Model"), "qwen3-4b-cc");
    await userEvent.click(screen.getByLabelText(/Let the model think/));
    await userEvent.clear(screen.getByLabelText("Timeout (seconds)"));
    await userEvent.type(screen.getByLabelText("Timeout (seconds)"), "30");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(await screen.findByText("Saved.")).toBeTruthy();
    expect(calls).toEqual([{ url: "/api/settings", method: "PUT", body: { llm: saved } }]);
  });

  it("clears cached answers and says how many went", async () => {
    const calls = fakeFetch({ "DELETE /api/settings/cache": { cleared: 3 } });
    render(<LlmSettingsForm initial={VIEW} />);
    await userEvent.click(screen.getByRole("button", { name: "Clear cache" }));
    expect(await screen.findByText("Cleared 3 cached entries.")).toBeTruthy();
    expect(calls.map((call) => `${call.method} ${call.url}`)).toEqual([
      "DELETE /api/settings/cache",
    ]);
  });

  it("shows why saving failed", async () => {
    vi.stubGlobal("fetch", async () =>
      Response.json({ error: "Too small: expected number to be >=1000" }, { status: 400 }),
    );
    render(<LlmSettingsForm initial={VIEW} />);
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(await screen.findByText(/Too small/)).toBeTruthy();
  });
});
