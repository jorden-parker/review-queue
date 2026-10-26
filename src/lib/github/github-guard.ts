import { runCommand, type Runner } from "@/lib/exec";

type GitHubBudgets = { perMinute: number; perHour: number; searchPerMinute: number };

type GuardOptions = {
  now: () => number;
  budgets: GitHubBudgets;
  cooldownMs: number;
};

export class GitHubBudgetError extends Error {
  constructor(reason: string, retryInMs: number) {
    super(`${reason}; try again in ${Math.ceil(retryInMs / 1000)}s`);
    this.name = "GitHubBudgetError";
  }
}

const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;
const GIT_NETWORK_SUBCOMMANDS = new Set(["clone", "fetch", "ls-remote", "pull", "push"]);
const RATE_LIMIT_PATTERN = /rate limit|abuse detection|HTTP 429/i;

const DEFAULT_OPTIONS: GuardOptions = {
  now: Date.now,
  budgets: { perMinute: 20, perHour: 300, searchPerMinute: 6 },
  cooldownMs: 15 * MINUTE_MS,
};

function reachesGitHub(command: string, args: string[]): boolean {
  if (command === "gh") return true;
  return command === "git" && GIT_NETWORK_SUBCOMMANDS.has(args[0]);
}

function isSearch(command: string, args: string[]): boolean {
  return command === "gh" && args[0] === "search";
}

function isRateLimitError(error: unknown): boolean {
  return error instanceof Error && RATE_LIMIT_PATTERN.test(error.message);
}

class CallWindow {
  private readonly times: number[] = [];

  record(time: number): void {
    this.times.push(time);
  }

  retryInMs(now: number, spanMs: number, limit: number): number {
    const recent = this.times.filter((time) => time > now - spanMs);
    if (recent.length < limit) return 0;
    return recent[recent.length - limit] + spanMs - now;
  }

  prune(now: number, spanMs: number): void {
    while (this.times.length > 0 && this.times[0] <= now - spanMs) this.times.shift();
  }
}

export function guardRunner(run: Runner, options: GuardOptions): Runner {
  const { now, budgets, cooldownMs } = options;
  const allCalls = new CallWindow();
  const searches = new CallWindow();
  let pausedUntil = 0;

  function refuseIfOverBudget(search: boolean): void {
    const time = now();
    if (time < pausedUntil) {
      throw new GitHubBudgetError(
        "GitHub rate limit was hit, calls are paused",
        pausedUntil - time,
      );
    }
    allCalls.prune(time, HOUR_MS);
    searches.prune(time, MINUTE_MS);
    const waitMs = Math.max(
      allCalls.retryInMs(time, MINUTE_MS, budgets.perMinute),
      allCalls.retryInMs(time, HOUR_MS, budgets.perHour),
      search ? searches.retryInMs(time, MINUTE_MS, budgets.searchPerMinute) : 0,
    );
    if (waitMs > 0) throw new GitHubBudgetError("GitHub call budget reached", waitMs);
  }

  function record(search: boolean): void {
    allCalls.record(now());
    if (search) searches.record(now());
  }

  return async (command, args, runOptions) => {
    if (!reachesGitHub(command, args)) return run(command, args, runOptions);
    const search = isSearch(command, args);
    refuseIfOverBudget(search);
    record(search);
    try {
      return await run(command, args, runOptions);
    } catch (error) {
      if (isRateLimitError(error)) pausedUntil = now() + cooldownMs;
      throw error;
    }
  };
}

const globals = globalThis as { reviewQueueGitHubRun?: Runner };

export const githubRun: Runner = (command, args, options) => {
  globals.reviewQueueGitHubRun ??= guardRunner(runCommand, DEFAULT_OPTIONS);
  return globals.reviewQueueGitHubRun(command, args, options);
};
