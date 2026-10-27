import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { ChangeNode } from "@/lib/types";
import type { MapRow, MapSection } from "./map-rows";
import { ChangeMapList, focusCurrentStop } from "./change-map-list";

function node(overrides: Partial<ChangeNode> = {}): ChangeNode {
  return {
    id: "src/store.ts#save",
    path: "src/store.ts",
    name: "save",
    kind: "function",
    role: "core",
    line: 4,
    hunkIndexes: [0],
    stepId: null,
    ...overrides,
  };
}

function row(overrides: Partial<MapRow> & { node: ChangeNode }): MapRow {
  return {
    key: `s|${overrides.node.id}`,
    depth: 0,
    kind: "entry",
    done: false,
    current: false,
    showPath: true,
    showRole: true,
    linkedIds: [],
    ...overrides,
  };
}

const THREAD: MapSection = {
  id: "routes.ts#handler",
  title: "handler",
  readCount: 1,
  total: 3,
  connected: true,
  rows: [
    row({
      node: node({ id: "routes.ts#handler", name: "handler", path: "routes.ts" }),
      linkedIds: ["src/store.ts#save"],
    }),
    row({
      node: node({ id: "src/store.ts#save", name: "save" }),
      kind: "uses",
      depth: 1,
      done: true,
      showRole: false,
      linkedIds: ["routes.ts#handler"],
    }),
    row({
      node: node({
        id: "src/store.test.ts#saves",
        name: "saves",
        path: "src/store.test.ts",
        role: "test",
      }),
      kind: "test",
      depth: 1,
      current: true,
    }),
  ],
};

const STOP_NAME = (name: string) => new RegExp(`^${name},`);

function stop(name: string): HTMLElement {
  return screen.getByRole("button", { name: STOP_NAME(name) });
}

function renderList(sections: MapSection[]) {
  const onOpen = vi.fn();
  render(<ChangeMapList sections={sections} onOpen={onOpen} />);
  return { onOpen, user: userEvent.setup() };
}

describe("ChangeMapList", () => {
  it("renders a heading for each thread", () => {
    renderList([THREAD]);
    expect(screen.getByRole("heading", { name: "handler" })).toBeTruthy();
  });

  it("calls onOpen with the node when its row is clicked", async () => {
    const { onOpen, user } = renderList([THREAD]);
    await user.click(screen.getByText("save").closest("button") as HTMLElement);
    expect(onOpen).toHaveBeenCalledWith(THREAD.rows[1].node);
  });

  it("renders the Not connected section", () => {
    const orphan: MapSection = {
      id: "orphans",
      title: "Not connected",
      readCount: 0,
      total: 2,
      connected: false,
      rows: [
        row({
          node: node({ id: "lonely.ts#lonely", name: "lonely", path: "lonely.ts" }),
          kind: "uses",
        }),
        row({
          node: node({ id: "alone.ts#alone", name: "alone", path: "alone.ts" }),
          kind: "uses",
        }),
      ],
    };
    const { container } = render(<ChangeMapList sections={[orphan]} onOpen={vi.fn()} />);
    expect(screen.getByRole("heading", { name: "Not connected" })).toBeTruthy();
    expect(container.querySelector('[data-map-line="trunk"]')).toBeNull();
  });

  it("marks a done stop as read", () => {
    renderList([THREAD]);
    const doneButton = stop("save");
    expect(doneButton.getAttribute("data-state")).toBe("read");
  });

  it("marks the current row with aria-current", () => {
    renderList([THREAD]);
    const current = screen.getByRole("button", { name: /saves/ });
    expect(current.getAttribute("aria-current")).toBe("step");
  });

  it("labels test rows as tested by", () => {
    renderList([THREAD]);
    const testRow = screen.getByRole("button", { name: /saves/ });
    expect(within(testRow).getByText("tested by")).toBeTruthy();
  });

  it("shows the empty state when there are no sections", () => {
    renderList([]);
    expect(screen.getByText("No changed symbols to map.")).toBeTruthy();
  });

  it("shows the model's part under the row it describes", () => {
    const parts = new Map([
      ["routes.ts#handler", { part: "Entry point for saving settings.", weight: "essential" }],
    ]);
    render(<ChangeMapList sections={[THREAD]} onOpen={vi.fn()} parts={parts} />);
    expect(screen.getByText("Entry point for saving settings.")).toBeTruthy();
  });

  it("draws the line through a connected thread", () => {
    const { container } = render(<ChangeMapList sections={[THREAD]} onOpen={vi.fn()} />);
    expect(container.querySelectorAll('[data-map-line="trunk"]').length).toBeGreaterThan(0);
  });

  it("shows how much of each thread is read", () => {
    renderList([THREAD]);
    expect(screen.getByText("1 of 3 read")).toBeTruthy();
  });

  it("collapses and expands a thread from its header", async () => {
    const { user } = renderList([THREAD]);
    const header = screen.getByRole("button", { name: "handler" });
    expect(header.getAttribute("aria-expanded")).toBe("true");

    await user.click(header);

    expect(header.getAttribute("aria-expanded")).toBe("false");
    expect(screen.queryByRole("button", { name: STOP_NAME("save") })).toBeNull();
  });

  it("starts with a fully read thread collapsed", () => {
    const read: MapSection = {
      ...THREAD,
      readCount: 3,
      rows: THREAD.rows.map((item) => ({ ...item, done: true, current: false })),
    };
    renderList([read]);
    expect(screen.getByRole("button", { name: "handler" }).getAttribute("aria-expanded")).toBe(
      "false",
    );
  });

  it("hides read stops when Hide read is on", async () => {
    const { user } = renderList([THREAD]);
    await user.click(screen.getByRole("button", { name: "Hide read" }));
    expect(screen.queryByRole("button", { name: STOP_NAME("save") })).toBeNull();
    expect(screen.getByRole("button", { name: /saves/ })).toBeTruthy();
  });

  it("offers Hide incidental only when the model has described the changes", () => {
    renderList([THREAD]);
    expect(screen.queryByRole("button", { name: "Hide incidental" })).toBeNull();
  });

  it("hides incidental stops when Hide incidental is on", async () => {
    const parts = new Map([["src/store.ts#save", { part: "Saves it.", weight: "incidental" }]]);
    render(<ChangeMapList sections={[THREAD]} onOpen={vi.fn()} parts={parts} />);
    await userEvent.setup().click(screen.getByRole("button", { name: "Hide incidental" }));
    expect(screen.queryByText("Saves it.")).toBeNull();
  });

  it("highlights the stops linked to the hovered stop", async () => {
    const { user } = renderList([THREAD]);
    await user.hover(stop("handler"));
    expect(stop("save").getAttribute("data-linked")).toBe("true");
    expect(screen.getByRole("button", { name: /saves/ }).getAttribute("data-linked")).toBe("false");
  });

  it("moves focus between stops with the arrow keys", async () => {
    const { user } = renderList([THREAD]);
    stop("handler").focus();

    await user.keyboard("{ArrowDown}");
    expect(document.activeElement).toBe(stop("save"));

    await user.keyboard("{End}");
    expect(document.activeElement).toBe(screen.getByRole("button", { name: /saves/ }));
  });

  it("moves focus from a stop to its thread header with ArrowLeft", async () => {
    const { user } = renderList([THREAD]);
    stop("save").focus();
    await user.keyboard("{ArrowLeft}");
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "handler" }));
  });

  it("shows a stop's path only when the row asks for it", () => {
    const quiet: MapSection = {
      ...THREAD,
      rows: THREAD.rows.map((item) => ({ ...item, showPath: false })),
    };
    renderList([quiet]);
    expect(screen.queryByText("store.ts")).toBeNull();
  });
});

describe("focusCurrentStop", () => {
  it("focuses the current stop", () => {
    renderList([THREAD]);
    focusCurrentStop(document.body);
    expect(document.activeElement).toBe(screen.getByRole("button", { name: /saves/ }));
  });

  it("falls back to the first stop when none is current", () => {
    const noCurrent: MapSection = {
      ...THREAD,
      rows: THREAD.rows.map((item) => ({ ...item, current: false })),
    };
    renderList([noCurrent]);
    focusCurrentStop(document.body);
    expect(document.activeElement).toBe(stop("handler"));
  });
});
