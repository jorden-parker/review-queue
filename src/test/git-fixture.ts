import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { withoutRepositoryVariables } from "@/lib/git-env";

export type FixtureRepo = { root: string; origin: string; cacheRoot: string };

function git(cwd: string, ...args: string[]): string {
  return execFileSync("git", args, {
    cwd,
    encoding: "utf8",
    env: withoutRepositoryVariables(process.env),
  }).trim();
}

function writeFiles(dir: string, files: Record<string, string>): void {
  for (const [name, content] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(dir, name)), { recursive: true });
    fs.writeFileSync(path.join(dir, name), content);
  }
}

function commitAll(dir: string, message: string): void {
  git(dir, "add", "-A");
  git(dir, "-c", "user.email=t@t", "-c", "user.name=t", "commit", "-q", "-m", message);
}

export function createFixtureRepo(
  base: Record<string, string>,
  head: Record<string, string>,
  prNumber: number,
): FixtureRepo {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "review-queue-"));
  const origin = path.join(root, "origin");
  fs.mkdirSync(origin);
  git(origin, "init", "-q", "-b", "main");
  writeFiles(origin, base);
  commitAll(origin, "base");
  git(origin, "checkout", "-q", "-b", "feature");
  writeFiles(origin, head);
  commitAll(origin, "head");
  git(origin, "update-ref", `refs/pull/${prNumber}/head`, "feature");
  git(origin, "checkout", "-q", "main");
  return { root, origin, cacheRoot: path.join(root, "cache") };
}

export function removeFixtureRepo(fixture: FixtureRepo): void {
  fs.rmSync(fixture.root, { recursive: true, force: true });
}

export function pushFeatureCommit(
  fixture: FixtureRepo,
  prNumber: number,
  files: Record<string, string>,
): void {
  git(fixture.origin, "checkout", "-q", "feature");
  writeFiles(fixture.origin, files);
  commitAll(fixture.origin, "more");
  git(fixture.origin, "update-ref", `refs/pull/${prNumber}/head`, "feature");
  git(fixture.origin, "checkout", "-q", "main");
}

export function headOf(fixture: FixtureRepo, prNumber: number): string {
  return git(fixture.origin, "rev-parse", `refs/pull/${prNumber}/head`);
}

export function mainOf(fixture: FixtureRepo): string {
  return git(fixture.origin, "rev-parse", "main");
}

export function squashMergeFeature(fixture: FixtureRepo, files: Record<string, string>): void {
  writeFiles(fixture.origin, files);
  commitAll(fixture.origin, "squash merge");
}
