import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { runCommand } from "./exec";

describe("runCommand", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("runs git in its own directory even inside a git hook", async () => {
    const repo = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "review-queue-exec-")));
    await runCommand("git", ["init", "-q"], { cwd: repo });
    vi.stubEnv("GIT_DIR", path.join(os.tmpdir(), "elsewhere.git"));
    vi.stubEnv("GIT_INDEX_FILE", path.join(os.tmpdir(), "elsewhere-index"));
    const gitDir = await runCommand("git", ["rev-parse", "--absolute-git-dir"], { cwd: repo });
    expect(gitDir.trim()).toBe(path.join(repo, ".git"));
    fs.rmSync(repo, { recursive: true, force: true });
  });

  it("passes stdin through and reports failures with stderr", async () => {
    expect(await runCommand("cat", [], { input: "hello" })).toBe("hello");
    await expect(runCommand("git", ["no-such-command"])).rejects.toThrow(
      /git no-such-command failed/,
    );
  });
});
