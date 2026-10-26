import { describe, expect, it } from "vitest";
import { closePane, dropPane, pickPane, showPane, splitPane } from "./pane-layout";

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
