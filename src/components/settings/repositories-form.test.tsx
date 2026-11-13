import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { RepositoriesForm } from "./repositories-form";

type Call = { url: string; method: string; body: unknown };

function fakeFetch(answer: Response | Record<string, unknown>) {
  const calls: Call[] = [];
  vi.stubGlobal("fetch", async (url: string, init: RequestInit = {}) => {
    const method = init.method ?? "GET";
    calls.push({ url, method, body: init.body ? JSON.parse(String(init.body)) : null });
    return answer instanceof Response ? answer : Response.json(answer);
  });
  return calls;
}

afterEach(() => vi.unstubAllGlobals());

describe("RepositoriesForm", () => {
  it("shows the saved repositories one per line", () => {
    render(<RepositoriesForm initial={["acme/app", "acme/web"]} />);
    expect(screen.getByLabelText("Repositories")).toHaveProperty("value", "acme/app\nacme/web");
  });

  it("saves the lines trimmed, dropping blank ones", async () => {
    const calls = fakeFetch({ repositories: ["acme/app", "acme/web"] });
    render(<RepositoriesForm initial={[]} />);
    await userEvent.type(
      screen.getByLabelText("Repositories"),
      "  acme/app  {enter}{enter}acme/web{enter}   ",
    );
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(await screen.findByText("Saved.")).toBeTruthy();
    expect(calls).toEqual([
      {
        url: "/api/settings",
        method: "PUT",
        body: { repositories: ["acme/app", "acme/web"] },
      },
    ]);
  });

  it("shows why saving failed", async () => {
    fakeFetch(Response.json({ error: "repositories must be owner/repo" }, { status: 400 }));
    render(<RepositoriesForm initial={["not-a-repo"]} />);
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(await screen.findByText("repositories must be owner/repo")).toBeTruthy();
  });
});
