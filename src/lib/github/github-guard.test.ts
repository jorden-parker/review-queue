import { describe, expect, it } from "vitest";
import type { Runner } from "@/lib/exec";
import { GitHubBudgetError, guardRunner } from "./github-guard";

const MINUTE = 60_000;

function fakeClock() {
  let time = 0;
  return { now: () => time, advance: (ms: number) => (time += ms) };
}

function countingRunner(failure?: string) {
  const calls: string[][] = [];
  const run: Runner = async (command, args) => {
    calls.push([command, ...args]);
    if (failure) throw new Error(failure);
    return "ok";
  };
  return { run, calls };
}

function guarded(failure?: string) {
  const clock = fakeClock();
  const inner = countingRunner(failure);
  const run = guardRunner(inner.run, {
    now: clock.now,
    budgets: { perMinute: 3, perHour: 5, searchPerMinute: 1 },
    cooldownMs: 15 * MINUTE,
  });
  return { run, clock, calls: inner.calls };
}

async function callTimes(run: Runner, times: number, args = ["pr", "view"]) {
  for (let call = 0; call < times; call++) await run("gh", args);
}

describe("guardRunner", () => {
  it("refuses GitHub calls over the per-minute budget without running them", async () => {
    const { run, calls } = guarded();
    await callTimes(run, 3);
    await expect(run("gh", ["pr", "view"])).rejects.toBeInstanceOf(GitHubBudgetError);
    expect(calls).toHaveLength(3);
  });

  it("allows calls again once the minute window passes", async () => {
    const { run, clock } = guarded();
    await callTimes(run, 3);
    clock.advance(MINUTE);
    await expect(run("gh", ["pr", "view"])).resolves.toBe("ok");
  });

  it("enforces the hourly budget across minutes", async () => {
    const { run, clock } = guarded();
    await callTimes(run, 3);
    clock.advance(MINUTE);
    await callTimes(run, 2);
    clock.advance(MINUTE);
    await expect(run("gh", ["pr", "view"])).rejects.toBeInstanceOf(GitHubBudgetError);
  });

  it("holds searches to their own tighter budget", async () => {
    const { run } = guarded();
    await callTimes(run, 1, ["search", "prs"]);
    await expect(run("gh", ["search", "prs"])).rejects.toThrow(/try again in 60s/);
    await expect(run("gh", ["pr", "view"])).resolves.toBe("ok");
  });

  it("counts git network commands but never local ones", async () => {
    const { run, calls } = guarded();
    await callTimes(run, 3);
    await expect(run("git", ["fetch", "origin"])).rejects.toBeInstanceOf(GitHubBudgetError);
    await expect(run("git", ["rev-parse", "HEAD"])).resolves.toBe("ok");
    expect(calls).toHaveLength(4);
  });

  it("stops all GitHub calls for the cooldown after a rate-limit error", async () => {
    const { run, clock, calls } = guarded("gh api failed: HTTP 403: API rate limit exceeded");
    await expect(run("gh", ["pr", "view"])).rejects.toThrow(/rate limit exceeded/);
    clock.advance(10 * MINUTE);
    await expect(run("gh", ["pr", "view"])).rejects.toThrow(/try again in 300s/);
    expect(calls).toHaveLength(1);
    clock.advance(5 * MINUTE);
    await expect(run("gh", ["pr", "view"])).rejects.toThrow(/rate limit exceeded/);
    expect(calls).toHaveLength(2);
  });

  it("does not trip the breaker on ordinary failures", async () => {
    const { run, calls } = guarded("gh pr view failed: not found");
    await expect(run("gh", ["pr", "view"])).rejects.toThrow(/not found/);
    await expect(run("gh", ["pr", "view"])).rejects.toThrow(/not found/);
    expect(calls).toHaveLength(2);
  });
});
