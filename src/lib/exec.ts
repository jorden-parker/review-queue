import { type ChildProcessWithoutNullStreams, execFile, spawn } from "node:child_process";
import { withoutRepositoryVariables } from "./git-env";

export type RunOptions = { cwd?: string; input?: string };

export type Runner = (command: string, args: string[], options?: RunOptions) => Promise<string>;

const MAX_OUTPUT_BYTES = 256 * 1024 * 1024;

export const runCommand: Runner = (command, args, options = {}) =>
  new Promise((resolve, reject) => {
    const child = execFile(
      command,
      args,
      {
        cwd: options.cwd,
        env: withoutRepositoryVariables(process.env),
        maxBuffer: MAX_OUTPUT_BYTES,
        encoding: "utf8",
      },
      (error, stdout, stderr) => {
        if (error) {
          reject(new Error(`${command} ${args.join(" ")} failed: ${stderr || error.message}`));
          return;
        }
        resolve(stdout);
      },
    );
    if (options.input !== undefined) child.stdin?.end(options.input);
  });

export type SpawnOptions = { cwd: string; env?: Record<string, string> };

const INHERITED_VARIABLES = [
  "PATH",
  "HOME",
  "USER",
  "LOGNAME",
  "SHELL",
  "TERM",
  "LANG",
  "LC_ALL",
  "LC_CTYPE",
  "TMPDIR",
  "TZ",
  "XDG_CACHE_HOME",
  "XDG_CONFIG_HOME",
  "XDG_DATA_HOME",
  "GOPATH",
  "GOROOT",
  "GOCACHE",
  "GOMODCACHE",
  "CARGO_HOME",
  "RUSTUP_HOME",
];

function inheritedEnvironment(): NodeJS.ProcessEnv {
  const source = withoutRepositoryVariables(process.env);
  return Object.fromEntries(
    INHERITED_VARIABLES.flatMap((name) => {
      const value = source[name];
      return value === undefined ? [] : [[name, value]];
    }),
  ) as NodeJS.ProcessEnv;
}

export function spawnProcess(
  command: string,
  args: string[],
  options: SpawnOptions,
): ChildProcessWithoutNullStreams {
  return spawn(command, args, {
    cwd: options.cwd,
    env: { ...inheritedEnvironment(), ...options.env },
    stdio: "pipe",
  });
}
