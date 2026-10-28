import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Session } from "@/lib/session/store";
import type { DefinitionWithCode, ReferenceWithCode } from "@/lib/review/peek-code";
import type { SymbolPosition } from "@/lib/types";
import { emptySession, HEAD_SHA, REF } from "@/test/review-fixture";
import { fetchDefinitions, fetchReferences } from "./api";
import { useJumps } from "./use-jumps";
import { usePeek } from "./use-peek";
import type { Act } from "./use-step-navigation";

vi.mock("./api", () => ({ fetchDefinitions: vi.fn(), fetchReferences: vi.fn() }));

function definition(name: string): DefinitionWithCode {
  return {
    name,
    kind: "function",
    path: "src/client.ts",
    line: 3,
    endLine: 5,
    lines: [],
    tokens: [],
    source: "index",
    scope: "file",
    signature: "",
    hover: null,
  };
}

function reference(text: string): ReferenceWithCode {
  return { path: "src/client.ts", line: 10, text, tokens: [] };
}

const LENS: SymbolPosition = {
  name: "load",
  path: "src/client.ts",
  line: 10,
  character: 16,
  side: "new",
};

const ALPHA: SymbolPosition = {
  name: "Alpha",
  path: "src/types.ts",
  line: 1,
  character: 0,
  side: "new",
};

const TYPES_LINE = { path: "src/types.ts", line: 1 };

function renderJumps(initialSession: Session = emptySession()) {
  const recordAction = vi.fn<Act>().mockResolvedValue(undefined);
  const openLocation = vi.fn();
  const { result, rerender } = renderHook(
    ({ session }: { session: Session }) => {
      const peek = usePeek(REF, HEAD_SHA, () => undefined);
      const jumps = useJumps(session, recordAction, openLocation, peek);
      return { peek, jumps };
    },
    { initialProps: { session: initialSession } },
  );
  return { result, rerender, recordAction, openLocation };
}

beforeEach(() => {
  vi.mocked(fetchDefinitions).mockResolvedValue([definition("Alpha")]);
  vi.mocked(fetchReferences).mockResolvedValue([reference("a")]);
});

describe("useJumps", () => {
  it("records the symbol peeked from a reference lens as the jump origin", async () => {
    const { result, rerender, recordAction, openLocation } = renderJumps();
    await act(async () => result.current.peek.showReferences(LENS));

    act(() => result.current.jumps.goToFromPeek(TYPES_LINE));

    expect(recordAction).toHaveBeenCalledWith(
      { type: "jump-push", name: "load", path: "src/client.ts", line: 10 },
      expect.any(Function),
    );
    expect(openLocation).toHaveBeenLastCalledWith(TYPES_LINE);

    rerender({
      session: emptySession({ jumps: [{ name: "load", path: "src/client.ts", line: 10 }] }),
    });
    act(() => result.current.jumps.back());

    expect(openLocation).toHaveBeenLastCalledWith({ path: "src/client.ts", line: 10 });
    expect(recordAction).toHaveBeenCalledWith({ type: "jump-pop" }, expect.any(Function));
  });

  it("records the symbol the reader is looking at, not an earlier peek", async () => {
    const { result, recordAction } = renderJumps();
    await act(async () => result.current.jumps.peekName(ALPHA));
    await act(async () => result.current.peek.showReferences(LENS));

    act(() => result.current.jumps.goToFromPeek(TYPES_LINE));

    expect(recordAction).toHaveBeenLastCalledWith(
      { type: "jump-push", name: "load", path: "src/client.ts", line: 10 },
      expect.any(Function),
    );
    expect(recordAction).not.toHaveBeenCalledWith(
      expect.objectContaining({ name: "Alpha" }),
      expect.any(Function),
    );
  });
});
