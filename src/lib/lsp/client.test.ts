import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { runCommand } from "@/lib/exec";
import { linkWorkspacePackages } from "@/lib/git/workspace-links";
import { LanguageClient } from "./client";
import { serverFor, type LanguageServer } from "./servers";

const STORE = "export function load(id: string) {\n  return id;\n}\n";
const APP = [
  "import { load } from './store';",
  "export function run(load: number) {",
  "  const total = load + 1;",
  "  console.log(total);",
  "}",
  "export const start = () => load;",
  "import { missing } from '@acme/missing';",
  "export const gone = () => missing;",
  "",
].join("\n");
const STORE_TEST = "import { load } from '../src/store';\nexport const loaded = load('a');\n";

describe("LanguageClient with typescript-language-server", () => {
  let root: string;
  let client: LanguageClient;

  beforeAll(async () => {
    root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "lsp-client-")));
    fs.mkdirSync(path.join(root, "src"));
    fs.writeFileSync(path.join(root, "src/store.ts"), STORE);
    fs.writeFileSync(path.join(root, "src/app.ts"), APP);
    fs.mkdirSync(path.join(root, "test"));
    fs.writeFileSync(path.join(root, "test/store.ts"), STORE_TEST);
    fs.writeFileSync(path.join(root, "readme.md"), "Call load to fetch.\n");
    fs.writeFileSync(
      path.join(root, "tsconfig.json"),
      '{"compilerOptions":{"strict":true},"include":["src"]}',
    );
    client = await LanguageClient.start(serverFor("src/app.ts")!, root, (file) =>
      fs.readFileSync(path.join(root, file), "utf8"),
    );
  }, 30_000);

  afterAll(async () => {
    await client.stop();
    fs.rmSync(root, { recursive: true, force: true });
  });

  it("resolves a parameter to its own declaration rather than a same-named import", async () => {
    const [location] = await client.definition("src/app.ts", 3, 16);
    expect(location).toMatchObject({ file: path.join(root, "src/app.ts"), line: 2 });
  });

  it("resolves an imported name through to its source file", async () => {
    const [location] = await client.definition("src/app.ts", 6, 27);
    expect(location).toMatchObject({ file: path.join(root, "src/store.ts"), line: 1 });
    expect(location.endLine).toBe(3);
    expect(location.declarationLine).toBe(1);
  });

  it("finds references and hover text", async () => {
    const references = await client.references("src/app.ts", 3, 8);
    expect(references.map((location) => location.line)).toEqual([4]);
    expect(await client.hover("src/app.ts", 3, 8)).toContain("const total: number");
  });

  it("finds references in related files outside the tsconfig project", async () => {
    const references = await client.references("src/store.ts", 1, 16, [
      "test/store.ts",
      "readme.md",
    ]);
    const files = references.map((location) => path.relative(root, location.file));
    expect(files).toContain("test/store.ts");
    expect(files).not.toContain("readme.md");
  });

  it("answers a repeated references query with the same related files", async () => {
    const query = () => client.references("src/store.ts", 1, 16, ["test/store.ts"]);
    const first = await query();
    const second = await query();
    const files = (locations: { file: string }[]) =>
      locations.map((location) => path.relative(root, location.file));
    expect(files(second)).toEqual(files(first));
    expect(files(second)).toContain("test/store.ts");
  });

  it("reports library definitions with their real location", async () => {
    const [location] = await client.definition("src/app.ts", 4, 2);
    expect(location.file).not.toContain(root);
  });

  it("answers an import the project cannot resolve with the import itself", async () => {
    const [location] = await client.definition("src/app.ts", 8, 26);
    expect(location).toMatchObject({
      file: path.join(root, "src/app.ts"),
      line: 7,
      declarationLine: 7,
    });
    expect(await client.hover("src/app.ts", 8, 26)).toContain("import missing");
  });
});

const MONOREPO: Record<string, string> = {
  "packages/config/package.json": JSON.stringify({ name: "@acme/config" }),
  "packages/config/app.json": JSON.stringify({
    compilerOptions: { module: "esnext", moduleResolution: "bundler", jsx: "preserve" },
  }),
  "packages/ui/package.json": JSON.stringify({
    name: "@acme/ui",
    exports: { "./button": "./src/button.tsx" },
  }),
  "packages/ui/tsconfig.json": JSON.stringify({ extends: "@acme/config/app.json" }),
  "packages/ui/src/button.tsx": "export function Button() {\n  return <button />;\n}\n",
  "apps/web/package.json": JSON.stringify({ name: "web" }),
  "apps/web/tsconfig.json": JSON.stringify({ extends: "@acme/config/app.json" }),
  "apps/web/page.tsx":
    'import { Button } from "@acme/ui/button";\nexport const Page = () => <Button />;\n',
};

describe("LanguageClient in a workspace monorepo", () => {
  let root: string;
  let client: LanguageClient;

  beforeAll(async () => {
    root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "lsp-monorepo-")));
    for (const [file, text] of Object.entries(MONOREPO)) {
      fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
      fs.writeFileSync(path.join(root, file), text);
    }
    await runCommand("git", ["init", "-q"], { cwd: root });
    await runCommand("git", ["add", "-A"], { cwd: root });
    await linkWorkspacePackages(root, runCommand);
    client = await LanguageClient.start(serverFor("apps/web/page.tsx")!, root, (file) =>
      fs.readFileSync(path.join(root, file), "utf8"),
    );
  }, 30_000);

  afterAll(async () => {
    await client.stop();
    fs.rmSync(root, { recursive: true, force: true });
  });

  it("finds a component's uses in packages that import it by package name", async () => {
    const references = await client.references("packages/ui/src/button.tsx", 1, 16, [
      "apps/web/page.tsx",
    ]);
    const files = references.map((location) => path.relative(root, location.file));
    expect(files).toContain("apps/web/page.tsx");
  });
});

const SILENT_SERVER =
  "require('fs').writeFileSync(process.argv[1], String(process.pid)); setInterval(() => {}, 1000);";

function pidOf(file: string): number | undefined {
  if (!fs.existsSync(file)) return undefined;
  const text = fs.readFileSync(file, "utf8");
  return text ? Number(text) : undefined;
}

function isRunning(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

async function pollUntil<T>(read: () => T | undefined): Promise<T | undefined> {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const value = read();
    if (value !== undefined) return value;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  return undefined;
}

describe("LanguageClient.start with a server that never answers", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("rejects, kills the child and leaves no process behind", async () => {
    vi.stubEnv("REVIEW_QUEUE_LSP_TIMEOUT_MS", "200");
    const pidFile = path.join(os.tmpdir(), `lsp-silent-${process.pid}-${Date.now()}.pid`);
    const silent: LanguageServer = {
      id: "typescript",
      languageIds: { ".ts": "typescript" },
      command: process.execPath,
      args: ["-e", SILENT_SERVER, pidFile],
      env: {},
      initializationOptions: {},
      settings: {},
    };
    let pid: number | undefined;
    try {
      await expect(LanguageClient.start(silent, os.tmpdir(), () => "")).rejects.toThrow(
        "initialize timed out",
      );
      pid = await pollUntil(() => pidOf(pidFile));
      expect(pid).toBeDefined();
      expect(await pollUntil(() => (isRunning(pid!) ? undefined : true))).toBe(true);
    } finally {
      if (pid !== undefined && isRunning(pid)) process.kill(pid, "SIGKILL");
      fs.rmSync(pidFile, { force: true });
    }
  });
});
