import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { runCommand } from "@/lib/exec";
import { linkWorkspacePackages } from "./workspace-links";

const PACKAGES: Record<string, string> = {
  "package.json": JSON.stringify({ name: "root" }),
  "packages/ui/package.json": JSON.stringify({ name: "@acme/ui" }),
  "packages/utils/package.json": JSON.stringify({ name: "utils" }),
  "packages/escape/package.json": JSON.stringify({ name: "../../outside" }),
  "packages/unnamed/package.json": JSON.stringify({ private: true }),
  "packages/broken/package.json": "{",
  "vendor/node_modules/left-pad/package.json": JSON.stringify({ name: "left-pad" }),
};

async function repoWith(files: Record<string, string>): Promise<string> {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "workspace-links-")));
  for (const [file, text] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
    fs.writeFileSync(path.join(root, file), text);
  }
  await runCommand("git", ["init", "-q"], { cwd: root });
  await runCommand("git", ["add", "-A", "-f"], { cwd: root });
  return root;
}

function linkTarget(root: string, name: string): string {
  return fs.realpathSync(path.join(root, "node_modules", name));
}

describe("linkWorkspacePackages", () => {
  let root: string;

  beforeEach(async () => {
    root = await repoWith(PACKAGES);
  });

  it("links every named workspace package into the root node_modules", async () => {
    await linkWorkspacePackages(root, runCommand);
    expect(linkTarget(root, "@acme/ui")).toBe(path.join(root, "packages/ui"));
    expect(linkTarget(root, "utils")).toBe(path.join(root, "packages/utils"));
  });

  it("skips the root package, unsafe names, unnamed or broken manifests and dependencies", async () => {
    await linkWorkspacePackages(root, runCommand);
    expect(fs.readdirSync(path.join(root, "node_modules")).sort()).toEqual(["@acme", "utils"]);
    expect(fs.existsSync(path.join(root, "outside"))).toBe(false);
  });

  it("can run again over links it already made", async () => {
    await linkWorkspacePackages(root, runCommand);
    await linkWorkspacePackages(root, runCommand);
    expect(linkTarget(root, "utils")).toBe(path.join(root, "packages/utils"));
  });
});
