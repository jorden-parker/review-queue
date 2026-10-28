import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { DefinitionWithCode, ReferenceWithCode } from "@/lib/review/peek-code";
import type { SymbolPosition } from "@/lib/types";
import { HEAD_SHA, REF } from "@/test/review-fixture";
import { fetchDefinitions, fetchReferences } from "./api";
import { usePeek } from "./use-peek";

vi.mock("./api", () => ({ fetchDefinitions: vi.fn(), fetchReferences: vi.fn() }));

type Deferred<T> = {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (error: unknown) => void;
};

function deferred<T>(): Deferred<T> {
  let settleResolve: (value: T) => void = () => undefined;
  let settleReject: (error: unknown) => void = () => undefined;
  const promise = new Promise<T>((resolve, reject) => {
    settleResolve = resolve;
    settleReject = reject;
  });
  return {
    promise,
    resolve: (value) => settleResolve(value),
    reject: (error) => settleReject(error),
  };
}

function replyFor<T>(replies: Map<string, Deferred<T>>, name: string): Deferred<T> {
  const existing = replies.get(name);
  if (existing) return existing;
  const created = deferred<T>();
  replies.set(name, created);
  return created;
}

const definitionReplies = new Map<string, Deferred<DefinitionWithCode[]>>();
const referenceReplies = new Map<string, Deferred<ReferenceWithCode[]>>();

function position(name: string, line: number): SymbolPosition {
  return { name, path: "src/client.ts", line, character: 4, side: "new" };
}

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

const ALPHA = position("Alpha", 3);
const BETA = position("Beta", 20);

function renderPeek() {
  const onDefinitions = vi.fn();
  const { result } = renderHook(() => usePeek(REF, HEAD_SHA, onDefinitions));
  return { result, onDefinitions };
}

async function settleDefinitions(name: string, value: DefinitionWithCode[]) {
  await act(async () => replyFor(definitionReplies, name).resolve(value));
}

async function rejectDefinitions(name: string, error: unknown) {
  await act(async () => replyFor(definitionReplies, name).reject(error));
}

async function settleReferences(name: string, value: ReferenceWithCode[]) {
  await act(async () => replyFor(referenceReplies, name).resolve(value));
}

beforeEach(() => {
  vi.clearAllMocks();
  definitionReplies.clear();
  referenceReplies.clear();
  vi.mocked(fetchDefinitions).mockImplementation(
    (_ref, _sha, at) => replyFor(definitionReplies, at.name).promise,
  );
  vi.mocked(fetchReferences).mockImplementation(
    (_ref, _sha, at) => replyFor(referenceReplies, at.name).promise,
  );
});

describe("usePeek", () => {
  it("keeps the panel on the newest peek when an earlier definitions reply comes back empty", async () => {
    const { result, onDefinitions } = renderPeek();
    act(() => result.current.showDefinitions(ALPHA));
    act(() => result.current.showDefinitions(BETA));

    await settleDefinitions("Beta", [definition("Beta")]);
    await settleDefinitions("Alpha", []);

    expect(result.current.peek?.position.name).toBe("Beta");
    expect(result.current.peek?.tab).toBe("definitions");
    expect(result.current.peek?.definitions).toEqual([definition("Beta")]);
    expect(onDefinitions).toHaveBeenCalledWith(ALPHA, []);
  });

  it("drops a late references reply from an earlier peek", async () => {
    const { result } = renderPeek();
    act(() => result.current.showDefinitions(ALPHA));
    act(() => result.current.showDefinitions(BETA));

    await settleReferences("Alpha", [reference("a")]);
    expect(result.current.peek?.references).toBeNull();

    await settleReferences("Beta", [reference("b")]);
    expect(result.current.peek?.references).toEqual([reference("b")]);
  });

  it("drops a late error from an earlier peek", async () => {
    const { result } = renderPeek();
    act(() => result.current.showDefinitions(ALPHA));
    act(() => result.current.showDefinitions(BETA));
    await settleDefinitions("Beta", [definition("Beta")]);
    await settleReferences("Beta", [reference("b")]);

    await rejectDefinitions("Alpha", new Error("Alpha failed"));

    expect(result.current.peek?.error).toBeNull();
  });

  it("asks for references once when the definitions are empty", async () => {
    const { result } = renderPeek();
    act(() => result.current.showDefinitions(ALPHA));

    await settleDefinitions("Alpha", []);
    await settleReferences("Alpha", [reference("a")]);

    expect(result.current.peek?.tab).toBe("references");
    expect(result.current.peek?.references).toEqual([reference("a")]);
    expect(fetchReferences).toHaveBeenCalledTimes(1);
  });

  it("asks for references once when the reader switches tabs on the same symbol", async () => {
    const { result } = renderPeek();
    act(() => result.current.showDefinitions(ALPHA));
    await settleDefinitions("Alpha", [definition("Alpha")]);
    await settleReferences("Alpha", [reference("a")]);

    act(() => result.current.showReferences(ALPHA));
    await act(async () => result.current.showDefinitions(ALPHA));

    expect(fetchReferences).toHaveBeenCalledTimes(1);
    expect(fetchDefinitions).toHaveBeenCalledTimes(2);
  });

  it("drops replies still in flight after the peek closes", async () => {
    const { result } = renderPeek();
    act(() => result.current.showDefinitions(ALPHA));
    act(() => result.current.close());

    await settleDefinitions("Alpha", []);

    expect(result.current.peek).toBeNull();
  });

  it("opens another symbol's references as its own peek without requesting its definitions", async () => {
    const { result } = renderPeek();
    act(() => result.current.showDefinitions(ALPHA));
    await settleDefinitions("Alpha", [definition("Alpha")]);

    act(() => result.current.showReferences(BETA));

    expect(result.current.peek?.position).toBe(BETA);
    expect(result.current.peek?.tab).toBe("references");
    expect(fetchReferences).toHaveBeenLastCalledWith(REF, HEAD_SHA, BETA);
    expect(fetchDefinitions).toHaveBeenCalledTimes(1);
  });
});
