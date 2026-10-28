import { describe, expect, it, vi } from "vitest";
import { createFrameBatcher, createLimiter } from "./request-queue";

type Gate<T> = { promise: Promise<T>; open: (value: T) => void };

function gate<T>(): Gate<T> {
  let open: (value: T) => void = () => undefined;
  const promise = new Promise<T>((resolve) => {
    open = resolve;
  });
  return { promise, open };
}

function settle() {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

function fakeFrames() {
  let pending: (() => void)[] = [];
  let requests = 0;
  return {
    requestFrame: (run: () => void) => {
      requests += 1;
      pending.push(run);
    },
    requestCount: () => requests,
    flush: () => {
      const toRun = pending;
      pending = [];
      for (const run of toRun) run();
    },
  };
}

describe("createLimiter", () => {
  it("never runs more than the limit at once, and finishes every task", async () => {
    const limit = createLimiter(4);
    const gates = Array.from({ length: 10 }, () => gate<number>());
    let running = 0;
    let peak = 0;
    const results = gates.map((taskGate, index) =>
      limit(async () => {
        running += 1;
        peak = Math.max(peak, running);
        const value = await taskGate.promise;
        running -= 1;
        return value + index;
      }),
    );
    await settle();
    expect(peak).toBe(4);
    for (const taskGate of gates) {
      taskGate.open(0);
      await settle();
      expect(running).toBeLessThanOrEqual(4);
    }
    expect(await Promise.all(results)).toEqual(gates.map((_, index) => index));
    expect(peak).toBe(4);
  });

  it("starts waiting tasks in the order they were queued", async () => {
    const limit = createLimiter(1);
    const started: string[] = [];
    const tasks = ["first", "second", "third"].map((name) =>
      limit(async () => {
        started.push(name);
        return name;
      }),
    );
    await Promise.all(tasks);
    expect(started).toEqual(["first", "second", "third"]);
  });

  it("rejects the failing task's promise and still starts the next waiting task", async () => {
    const limit = createLimiter(1);
    const failing = limit(() => Promise.reject(new Error("boom")));
    const next = limit(async () => "next");
    await expect(failing).rejects.toThrow("boom");
    await expect(next).resolves.toBe("next");
  });
});

describe("createFrameBatcher", () => {
  it("publishes three records from one tick as one batch, in order", () => {
    const publish = vi.fn();
    const frames = fakeFrames();
    const record = createFrameBatcher<number>(publish, frames.requestFrame);
    record("a", 1);
    record("b", 2);
    record("c", 3);
    expect(frames.requestCount()).toBe(1);
    expect(publish).not.toHaveBeenCalled();
    frames.flush();
    expect(publish).toHaveBeenCalledTimes(1);
    expect(publish).toHaveBeenCalledWith([
      ["a", 1],
      ["b", 2],
      ["c", 3],
    ]);
  });

  it("requests a new frame for a record that arrives after the flush", () => {
    const publish = vi.fn();
    const frames = fakeFrames();
    const record = createFrameBatcher<number>(publish, frames.requestFrame);
    record("a", 1);
    frames.flush();
    record("b", 2);
    expect(frames.requestCount()).toBe(2);
    frames.flush();
    expect(publish).toHaveBeenLastCalledWith([["b", 2]]);
  });
});
