import fs from "node:fs";
import path from "node:path";
import type { Runner } from "@/lib/exec";

const PACKAGE_NAME = /^(@[a-z0-9-~][a-z0-9-._~]*\/)?[a-z0-9-~][a-z0-9-._~]*$/i;

function packageNameIn(manifest: string): string | null {
  if (!fs.lstatSync(manifest).isFile()) return null;
  try {
    const { name } = JSON.parse(fs.readFileSync(manifest, "utf8")) as { name?: unknown };
    return typeof name === "string" && PACKAGE_NAME.test(name) ? name : null;
  } catch {
    return null;
  }
}

async function workspaceManifests(root: string, run: Runner): Promise<string[]> {
  const output = await run("git", ["ls-files", "-z", "--", "*package.json"], { cwd: root });
  return output
    .split("\0")
    .filter((file) => path.basename(file) === "package.json")
    .filter((file) => path.dirname(file) !== "." && !file.split("/").includes("node_modules"));
}

function linkPackage(root: string, name: string, directory: string): void {
  const link = path.join(root, "node_modules", name);
  if (fs.lstatSync(link, { throwIfNoEntry: false })) return;
  fs.mkdirSync(path.dirname(link), { recursive: true });
  fs.symlinkSync(path.relative(path.dirname(link), path.join(root, directory)), link, "dir");
}

export async function linkWorkspacePackages(root: string, run: Runner): Promise<void> {
  for (const manifest of await workspaceManifests(root, run)) {
    const name = packageNameIn(path.join(root, manifest));
    if (name) linkPackage(root, name, path.dirname(manifest));
  }
}
