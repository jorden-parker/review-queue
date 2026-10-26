import os from "node:os";
import path from "node:path";

export function dataDirectory(): string {
  return path.join(os.homedir(), ".local", "share", "review-queue");
}
