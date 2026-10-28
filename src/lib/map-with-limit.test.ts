import { describe, expect, it, vi } from "vitest";
import { mapWithLimit } from "./map-with-limit";

const pause = (milliseconds: number) => new Promise((resolve) => setTimeout(resolve, milliseconds));

describe("mapWithLimit", () => {
  it("returns results in input order even when tasks finish out of order", async () => {
    const results = await mapWithLimit([30, 0, 10], 3, async (delay) => {
      await pause(delay);
      return delay;
    });
    expect(results).toEqual([30, 0, 10]);
  });

  it("never runs more tasks at once than the limit", async () => {
    let active = 0;
    let peak = 0;
    await mapWithLimit(
      Array.from({ length: 10 }, (_, index) => index),
      3,
      async () => {
        active += 1;
        peak = Math.max(peak, active);
        await pause(5);
        active -= 1;
      },
    );
    expect(peak).toBe(3);
  });

  it("runs nothing for an empty list", async () => {
    const task = vi.fn();
    expect(await mapWithLimit([], 4, task)).toEqual([]);
    expect(task).not.toHaveBeenCalled();
  });

  it("rejects with the first task error", async () => {
    await expect(
      mapWithLimit([1, 2], 2, async (value) => {
        if (value === 2) throw new Error("boom");
        return value;
      }),
    ).rejects.toThrow("boom");
  });
});
