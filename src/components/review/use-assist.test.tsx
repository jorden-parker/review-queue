import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AssistTarget } from "@/lib/assist-protocol";
import { streamAssist } from "./api";
import type { ParsedAssistStream } from "./assist-stream";
import { useAssist } from "./use-assist";

vi.mock("./api", () => ({ streamAssist: vi.fn() }));

const REF = { owner: "acme", repo: "app", number: 7 };
const HEAD = "a".repeat(40);
const NEW_HEAD = "b".repeat(40);
const TARGET: AssistTarget = { kind: "file", path: "src/a.ts" };

function reply(text: string): ParsedAssistStream {
  return { text, lookups: [], failure: null };
}

function setup(initialSha = HEAD) {
  const onSave = vi.fn();
  const hook = renderHook(({ headSha }: { headSha: string }) => useAssist(REF, headSha, onSave), {
    initialProps: { headSha: initialSha },
  });
  const lastText = () => hook.result.current.thread?.turns.at(-1)?.text;
  return { ...hook, onSave, lastText };
}

beforeEach(() => {
  vi.resetAllMocks();
});

describe("useAssist retry", () => {
  it("re-sends the same request after a failed first reply", async () => {
    vi.mocked(streamAssist)
      .mockRejectedValueOnce(new Error("LLM request failed (HTTP 503)"))
      .mockImplementationOnce(async (_ref, _sha, _request, onUpdate) =>
        onUpdate(reply("It sets a.")),
      );
    const { result, lastText } = setup();

    act(() => result.current.open(TARGET, "explain"));
    await waitFor(() => expect(result.current.error).toBe("LLM request failed (HTTP 503)"));
    act(() => result.current.retry());
    await waitFor(() => expect(lastText()).toBe("It sets a."));

    expect(streamAssist).toHaveBeenCalledTimes(2);
    expect(vi.mocked(streamAssist).mock.calls[1]?.[2]).toEqual(
      vi.mocked(streamAssist).mock.calls[0]?.[2],
    );
    expect(result.current.error).toBeNull();
  });

  it("does nothing once the reply has arrived", async () => {
    vi.mocked(streamAssist).mockImplementationOnce(async (_ref, _sha, _request, onUpdate) =>
      onUpdate(reply("Done.")),
    );
    const { result, lastText } = setup();

    act(() => result.current.open(TARGET, "explain"));
    await waitFor(() => expect(lastText()).toBe("Done."));
    act(() => result.current.retry());

    expect(streamAssist).toHaveBeenCalledTimes(1);
  });

  it("keeps the partial reply when the reader stops mid-stream", async () => {
    vi.mocked(streamAssist).mockImplementationOnce(
      (_ref, _sha, _request, onUpdate, signal) =>
        new Promise<void>((_resolve, reject) => {
          onUpdate(reply("It sets"));
          signal.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")));
        }),
    );
    const { result, onSave, lastText } = setup();

    act(() => result.current.open(TARGET, "explain"));
    await waitFor(() => expect(lastText()).toBe("It sets"));
    act(() => result.current.stop());

    await waitFor(() =>
      expect(onSave).toHaveBeenCalledWith(
        expect.objectContaining({
          turns: [
            { role: "reviewer", text: "Explain this file" },
            { role: "model", text: "It sets", ended: "stopped" },
          ],
        }),
      ),
    );
    expect(result.current.error).toBeNull();
  });

  it("saves a failed answer with what arrived and marks it failed", async () => {
    vi.mocked(streamAssist).mockImplementationOnce(async (_ref, _sha, _request, onUpdate) => {
      onUpdate(reply("Half an"));
      throw new Error("The model's answer ended early; try again");
    });
    const { result, onSave } = setup();

    act(() => result.current.open(TARGET, "explain"));
    await waitFor(() => expect(result.current.error).toMatch(/ended early/));
    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        turns: [
          { role: "reviewer", text: "Explain this file" },
          { role: "model", text: "Half an", ended: "failed" },
        ],
      }),
    );
  });

  it("refuses to send or retry on a thread asked on an older commit", async () => {
    vi.mocked(streamAssist).mockRejectedValueOnce(new Error("down"));
    const { result, rerender } = setup();

    act(() => result.current.open(TARGET, "explain"));
    await waitFor(() => expect(result.current.error).toBe("down"));
    rerender({ headSha: NEW_HEAD });
    act(() => result.current.retry());
    act(() => result.current.send("Why?"));

    expect(result.current.readOnly).toBe(true);
    expect(streamAssist).toHaveBeenCalledTimes(1);
  });
});

describe("useAssist superseded streams", () => {
  it("ignores updates from a stream that a retry has replaced", async () => {
    let emitFirst: ((parsed: ParsedAssistStream) => void) | undefined;
    vi.mocked(streamAssist)
      .mockImplementationOnce((_ref, _sha, _request, onUpdate) => {
        emitFirst = onUpdate;
        return new Promise<void>(() => {});
      })
      .mockImplementationOnce(async (_ref, _sha, _request, onUpdate) => onUpdate(reply("fresh")));
    const { result, lastText } = setup();

    act(() => result.current.open(TARGET, "explain"));
    act(() => result.current.stop());
    act(() => result.current.retry());
    await waitFor(() => expect(lastText()).toBe("fresh"));
    act(() => emitFirst?.(reply("stale")));

    expect(lastText()).toBe("fresh");
  });
});
