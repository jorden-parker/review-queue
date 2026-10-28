import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { runCommand } from "@/lib/exec";
import { linkWorkspacePackages } from "@/lib/git/workspace-links";
import { LanguageClient } from "./client";
import { serverFor } from "./servers";

const STORE = "export function load(id: string) {\n  return id;\n}\n";
const APP = [
  "import { load } from './store';",
  "export function run(load: number) {",
  "  const total = load + 1;",
  "  console.log(total);",
  "}",
  "export const start = () => load;",
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
