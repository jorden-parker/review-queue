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

export function spawnProcess(
  command: string,
  args: string[],
  options: SpawnOptions,
): ChildProcessWithoutNullStreams {
  return spawn(command, args, {
    cwd: options.cwd,
    env: { ...withoutRepositoryVariables(process.env), ...options.env },
    stdio: "pipe",
  });
}
