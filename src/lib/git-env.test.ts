import { devNull } from "node:os";
import { describe, expect, it } from "vitest";
import { commandEnvironment } from "./git-env";

const REVIEWER_ENVIRONMENT: NodeJS.ProcessEnv = {
  NODE_ENV: "test",
  PATH: "/usr/bin",
  GIT_CONFIG_GLOBAL: "/home/reviewer/.gitconfig",
  GIT_DIR: "/elsewhere.git",
};

describe("commandEnvironment", () => {
  it("hides the reviewer's git config from git commands that stay on this machine", () => {
    for (const subcommand of ["diff", "grep", "ls-files", "worktree", "log"]) {
      expect(commandEnvironment("git", [subcommand], REVIEWER_ENVIRONMENT)).toMatchObject({
        NODE_ENV: "test",
        PATH: "/usr/bin",
        GIT_CONFIG_GLOBAL: devNull,
        GIT_CONFIG_NOSYSTEM: "1",
      });
    }
  });

  it("keeps the reviewer's git config for git commands that reach the network", () => {
    for (const subcommand of ["clone", "fetch", "ls-remote", "pull", "push"]) {
      const environment = commandEnvironment("git", [subcommand], REVIEWER_ENVIRONMENT);
      expect(environment.GIT_CONFIG_GLOBAL).toBe("/home/reviewer/.gitconfig");
      expect(environment.GIT_CONFIG_NOSYSTEM).toBeUndefined();
    }
  });

  it("drops only the hook repository variables for commands that are not git", () => {
    expect(commandEnvironment("gh", ["api", "user"], REVIEWER_ENVIRONMENT)).toEqual({
      NODE_ENV: "test",
      PATH: "/usr/bin",
      GIT_CONFIG_GLOBAL: "/home/reviewer/.gitconfig",
    });
  });

  it("answers GitHub's credential request from the gh login and never prompts", () => {
    for (const subcommand of ["clone", "fetch"]) {
      expect(commandEnvironment("git", [subcommand], REVIEWER_ENVIRONMENT)).toMatchObject({
        GIT_TERMINAL_PROMPT: "0",
        GIT_CONFIG_COUNT: "2",
        GIT_CONFIG_KEY_0: "credential.https://github.com.helper",
        GIT_CONFIG_VALUE_0: "",
        GIT_CONFIG_KEY_1: "credential.https://github.com.helper",
        GIT_CONFIG_VALUE_1: "!gh auth git-credential",
      });
    }
  });

  it("adds no credential settings to git commands that stay on this machine", () => {
    const environment = commandEnvironment("git", ["diff"], REVIEWER_ENVIRONMENT);
    expect(environment.GIT_CONFIG_COUNT).toBeUndefined();
    expect(environment.GIT_TERMINAL_PROMPT).toBeUndefined();
  });
});
