import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { ChangeNode } from "@/lib/types";
import type { MapRow, MapSection } from "./map-rows";
import { ChangeMapList } from "./change-map-list";

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
    ...overrides,
  };
}

const THREAD: MapSection = {
  id: "routes.ts#handler",
  title: "handler",
  rows: [
    row({ node: node({ id: "routes.ts#handler", name: "handler", path: "routes.ts" }) }),
    row({
      node: node({ id: "src/store.ts#save", name: "save" }),
      kind: "uses",
      depth: 1,
      done: true,
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
      rows: [
        row({
          node: node({ id: "lonely.ts#lonely", name: "lonely", path: "lonely.ts" }),
          kind: "uses",
        }),
      ],
    };
    renderList([orphan]);
    expect(screen.getByRole("heading", { name: "Not connected" })).toBeTruthy();
  });

  it("shows a check on a done row", () => {
    renderList([THREAD]);
    const doneButton = screen.getByText("save").closest("button") as HTMLElement;
    expect(doneButton.parentElement?.querySelector("svg")).toBeTruthy();
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
});
