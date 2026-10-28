import { describe, expect, it } from "vitest";
import { resolveShortcut } from "./shortcut-keys";

describe("resolveShortcut", () => {
  it("maps single keys", () => {
    expect(resolveShortcut(null, "j")).toBe("next-hunk");
    expect(resolveShortcut(null, "P")).toBe("park");
    expect(resolveShortcut(null, "?")).toBe("help");
    expect(resolveShortcut(null, "i")).toBe("ask-model");
    expect(resolveShortcut(null, "Escape")).toBe("close");
    expect(resolveShortcut(null, "m")).toBe("pin-symbol");
    expect(resolveShortcut(null, "\\")).toBe("toggle-panel");
  });

  it("toggles each side with its own bracket", () => {
    expect(resolveShortcut(null, "[")).toBe("toggle-left-panel");
    expect(resolveShortcut(null, "]")).toBe("toggle-right-panel");
  });

  it("waits for the second key of a chord", () => {
    expect(resolveShortcut(null, "g")).toBe("pending");
    expect(resolveShortcut("g", "d")).toBe("peek-definition");
    expect(resolveShortcut("g", "r")).toBe("peek-references");
    expect(resolveShortcut("g", "c")).toBe("open-context");
    expect(resolveShortcut("g", "o")).toBe("open-outline");
    expect(resolveShortcut("g", "f")).toBe("open-files");
    expect(resolveShortcut("g", "m")).toBe("open-map");
    expect(resolveShortcut("g", "h")).toBe("open-hotspots");
    expect(resolveShortcut("g", "g")).toBe("open-github");
  });

  it("gives every g chord its own action", () => {
    const keys = ["d", "r", "c", "o", "f", "m", "h", "g"];
    const actions = keys.map((key) => resolveShortcut("g", key));
    expect(new Set(actions).size).toBe(keys.length);
  });

  it("drops unknown chords and keys", () => {
    expect(resolveShortcut("g", "z")).toBeNull();
    expect(resolveShortcut(null, "q")).toBeNull();
    expect(resolveShortcut(null, "h")).toBeNull();
  });
});
