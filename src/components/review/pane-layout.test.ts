import { describe, expect, it } from "vitest";
import {
  PANE_SIDES,
  type PaneId,
  type SideLayouts,
  closePane,
  dropPane,
  onPaneSide,
  openPaneOnSide,
  pickPane,
  showPane,
  splitPane,
  withOnlySide,
} from "./pane-layout";

describe("pickPane", () => {
  it("opens a closed pane on its own", () => {
    expect(pickPane(["step", "notes"], "path")).toEqual(["path"]);
  });

  it("closes a pane that is already open", () => {
    expect(pickPane(["step"], "step")).toEqual([]);
    expect(pickPane(["step", "notes"], "notes")).toEqual(["step"]);
  });
});

describe("splitPane", () => {
  it("adds a closed pane below the open ones", () => {
    expect(splitPane(["step"], "notes")).toEqual(["step", "notes"]);
  });

  it("removes a pane that is already open", () => {
    expect(splitPane(["step", "notes"], "step")).toEqual(["notes"]);
  });
});

describe("dropPane", () => {
  it("inserts a pane at the drop position", () => {
    expect(dropPane(["step", "notes"], "path", 1)).toEqual(["step", "path", "notes"]);
    expect(dropPane([], "path", 0)).toEqual(["path"]);
  });

  it("moves a pane that is already open", () => {
    expect(dropPane(["step", "notes", "path"], "path", 0)).toEqual(["path", "step", "notes"]);
    expect(dropPane(["step", "notes", "path"], "step", 3)).toEqual(["notes", "path", "step"]);
  });
});

describe("showPane", () => {
  it("replaces the open pane with the shown one", () => {
    expect(showPane(["step"], "chat")).toEqual(["chat"]);
    expect(showPane([], "context")).toEqual(["context"]);
  });

  it("keeps the layout when the pane is already open", () => {
    const layout = ["step", "context"] as const;
    expect(showPane([...layout], "context")).toEqual(["step", "context"]);
  });
});

describe("closePane", () => {
  it("removes only the closed pane", () => {
    expect(closePane(["step", "chat"], "chat")).toEqual(["step"]);
    expect(closePane(["step"], "chat")).toEqual(["step"]);
  });
});

describe("onPaneSide", () => {
  it("keeps the other side when a pane on one side is picked", () => {
    expect(onPaneSide({ left: ["chat"], right: ["step"] }, "path", pickPane)).toEqual({
      left: ["chat"],
      right: ["path"],
    });
  });

  it("changes only the left side when a context pane is shown", () => {
    expect(onPaneSide({ left: [], right: ["step"] }, "context", showPane)).toEqual({
      left: ["context"],
      right: ["step"],
    });
  });
});

describe("withOnlySide", () => {
  it("empties the other side and keeps the chosen one", () => {
    const layouts: SideLayouts = { left: ["chat"], right: ["step"] };
    expect(withOnlySide(layouts, "left")).toEqual({ left: ["chat"], right: [] });
    expect(withOnlySide(layouts, "right")).toEqual({ left: [], right: ["step"] });
  });
});

describe("openPaneOnSide", () => {
  it("leaves the other side open on a wide screen", () => {
    expect(openPaneOnSide({ left: ["chat"], right: ["step"] }, "path", pickPane, true)).toEqual({
      left: ["chat"],
      right: ["path"],
    });
  });

  it("empties the other side on a narrow screen when a pane opens", () => {
    expect(openPaneOnSide({ left: ["chat"], right: ["step"] }, "path", pickPane, false)).toEqual({
      left: [],
      right: ["path"],
    });
  });

  it("keeps both sides on a narrow screen when a pane closes", () => {
    expect(openPaneOnSide({ left: ["chat"], right: ["path"] }, "path", pickPane, false)).toEqual({
      left: ["chat"],
      right: [],
    });
  });
});

describe("PANE_SIDES", () => {
  it("gives every pane a side", () => {
    const everyPane: PaneId[] = [
      "about",
      "step",
      "path",
      "hotspots",
      "notes",
      "chat",
      "chats",
      "context",
      "outline",
    ];
    for (const pane of everyPane) {
      expect(["left", "right"]).toContain(PANE_SIDES[pane]);
    }
  });

  it("puts the chat tools on the left and the navigation panes on the right", () => {
    expect(PANE_SIDES.chat).toBe("left");
    expect(PANE_SIDES.chats).toBe("left");
    expect(PANE_SIDES.context).toBe("left");
    expect(PANE_SIDES.path).toBe("right");
  });
});
