import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { Runner } from "@/lib/exec";
import { githubRun } from "@/lib/github/github-guard";
import type { FileDiff, PullRequestRef } from "@/lib/types";
import { parseUnifiedDiff } from "./diff-parser";
import { linkWorkspacePackages } from "./workspace-links";

export type CheckoutOptions = {
  cacheRoot?: string;
  remoteUrl?: string;
  run?: Runner;
};

export type Checkout = {
  repoDir: string;
  worktreePath: string;
  headSha: string;
  mergeBaseSha: string;
  run: Runner;
};

const CHURN_COMMIT_LIMIT = 500;

function defaultCacheRoot(): string {
  return path.join(os.homedir(), ".cache", "review-queue");
}

function githubUrl(ref: PullRequestRef): string {
  return `https://github.com/${ref.owner}/${ref.repo}.git`;
}

async function ensureBareClone(remoteUrl: string, repoDir: string, run: Runner): Promise<void> {
  if (fs.existsSync(repoDir)) return;
  fs.mkdirSync(path.dirname(repoDir), { recursive: true });
  await run("git", ["clone", "--quiet", "--bare", remoteUrl, repoDir]);
}

export type PullCommits = { baseBranch: string; baseSha: string; headSha: string };

async function fetchRefs(
  ref: PullRequestRef,
  baseBranch: string,
  repoDir: string,
  run: Runner,
): Promise<void> {
  await run(
    "git",
    [
      "fetch",
      "--quiet",
      "--force",
      "origin",
      `+refs/pull/${ref.number}/head:refs/review/pr-${ref.number}`,
      `+refs/heads/${baseBranch}:refs/review/base-${ref.number}`,
    ],
    { cwd: repoDir },
  );
}

async function hasCommit(repoDir: string, sha: string, run: Runner): Promise<boolean> {
  return run("git", ["cat-file", "-e", `${sha}^{commit}`], { cwd: repoDir }).then(
    () => true,
    () => false,
  );
}

async function hasCommits(repoDir: string, commits: PullCommits, run: Runner): Promise<boolean> {
  return (
    (await hasCommit(repoDir, commits.headSha, run)) &&
    (await hasCommit(repoDir, commits.baseSha, run))
  );
}

async function resolveHead(
  ref: PullRequestRef,
  commits: PullCommits,
  repoDir: string,
  run: Runner,
): Promise<string> {
  if (await hasCommits(repoDir, commits, run)) return commits.headSha;
  await fetchRefs(ref, commits.baseBranch, repoDir, run);
  return revParse(repoDir, `refs/review/pr-${ref.number}`, run);
}

async function revParse(repoDir: string, name: string, run: Runner): Promise<string> {
  return (await run("git", ["rev-parse", name], { cwd: repoDir })).trim();
}

async function ensureWorktree(
  repoDir: string,
  worktreePath: string,
  sha: string,
  run: Runner,
): Promise<void> {
  if (fs.existsSync(worktreePath)) return;
  fs.mkdirSync(path.dirname(worktreePath), { recursive: true });
  await run("git", ["worktree", "add", "--quiet", "--detach", worktreePath, sha], {
    cwd: repoDir,
  });
}

export async function ensureCheckout(
  ref: PullRequestRef,
  commits: PullCommits,
  options: CheckoutOptions = {},
): Promise<Checkout> {
  const run = options.run ?? githubRun;
  const cacheRoot = options.cacheRoot ?? defaultCacheRoot();
  const repoDir = path.join(cacheRoot, "repos", ref.owner, `${ref.repo}.git`);
  await ensureBareClone(options.remoteUrl ?? githubUrl(ref), repoDir, run);
  const headSha = await resolveHead(ref, commits, repoDir, run);
  const mergeBaseSha = (
    await run("git", ["merge-base", commits.baseSha, headSha], { cwd: repoDir })
  ).trim();
  const worktreePath = path.join(cacheRoot, "worktrees", ref.owner, ref.repo, headSha);
  await ensureWorktree(repoDir, worktreePath, headSha, run);
  await linkWorkspacePackages(worktreePath, run);
  return { repoDir, worktreePath, headSha, mergeBaseSha, run };
}

export async function diffCheckout(checkout: Checkout, fromSha?: string): Promise<FileDiff[]> {
  const output = await checkout.run(
    "git",
    [
      "diff",
      "--no-color",
      "--no-ext-diff",
      "-M",
      "--end-of-options",
      fromSha ?? checkout.mergeBaseSha,
      checkout.headSha,
    ],
    { cwd: checkout.repoDir },
  );
  return parseUnifiedDiff(output);
}

export async function fileChurn(checkout: Checkout): Promise<Map<string, number>> {
  const output = await checkout.run(
    "git",
    ["log", "--format=", "--name-only", `-n${CHURN_COMMIT_LIMIT}`, checkout.headSha],
    { cwd: checkout.repoDir },
  );
  const churn = new Map<string, number>();
  for (const name of output.split("\n").filter(Boolean)) {
    churn.set(name, (churn.get(name) ?? 0) + 1);
  }
  return churn;
}
