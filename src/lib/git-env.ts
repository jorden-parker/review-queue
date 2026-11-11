import { devNull } from "node:os";

const REPOSITORY_VARIABLES = [
  "GIT_ALTERNATE_OBJECT_DIRECTORIES",
  "GIT_CONFIG",
  "GIT_CONFIG_PARAMETERS",
  "GIT_CONFIG_COUNT",
  "GIT_OBJECT_DIRECTORY",
  "GIT_DIR",
  "GIT_WORK_TREE",
  "GIT_IMPLICIT_WORK_TREE",
  "GIT_GRAFT_FILE",
  "GIT_INDEX_FILE",
  "GIT_NO_REPLACE_OBJECTS",
  "GIT_REPLACE_REF_BASE",
  "GIT_PREFIX",
  "GIT_SHALLOW_FILE",
  "GIT_COMMON_DIR",
];

export function withoutRepositoryVariables(env: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  const isolated = { ...env };
  for (const name of REPOSITORY_VARIABLES) delete isolated[name];
  return isolated;
}

export const GIT_NETWORK_SUBCOMMANDS = new Set(["clone", "fetch", "ls-remote", "pull", "push"]);

const WITHOUT_REVIEWER_CONFIG = { GIT_CONFIG_GLOBAL: devNull, GIT_CONFIG_NOSYSTEM: "1" };

const GITHUB_CREDENTIAL_HELPER = "credential.https://github.com.helper";

const WITH_GH_LOGIN = {
  GIT_TERMINAL_PROMPT: "0",
  GIT_CONFIG_COUNT: "2",
  GIT_CONFIG_KEY_0: GITHUB_CREDENTIAL_HELPER,
  GIT_CONFIG_VALUE_0: "",
  GIT_CONFIG_KEY_1: GITHUB_CREDENTIAL_HELPER,
  GIT_CONFIG_VALUE_1: "!gh auth git-credential",
};

export function commandEnvironment(
  command: string,
  args: string[],
  env: NodeJS.ProcessEnv,
): NodeJS.ProcessEnv {
  const isolated = withoutRepositoryVariables(env);
  if (command !== "git") return isolated;
  const overrides = GIT_NETWORK_SUBCOMMANDS.has(args[0]) ? WITH_GH_LOGIN : WITHOUT_REVIEWER_CONFIG;
  return { ...isolated, ...overrides };
}
