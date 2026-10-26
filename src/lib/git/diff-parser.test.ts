import { describe, expect, it } from "vitest";
import { parseUnifiedDiff } from "./diff-parser";

const MODIFIED = `diff --git a/src/a.ts b/src/a.ts
index 111..222 100644
--- a/src/a.ts
+++ b/src/a.ts
@@ -1,3 +1,4 @@ export function a() {
 const x = 1;
-const y = 2;
+const y = 3;
+const z = 4;
 return x;
`;

const ADDED_AND_RENAMED = `diff --git a/new.go b/new.go
new file mode 100644
index 000..333
--- /dev/null
+++ b/new.go
@@ -0,0 +1,2 @@
+package main
+func F() {}
diff --git a/old/name.py b/new/name.py
similarity index 100%
rename from old/name.py
rename to new/name.py
diff --git a/gone.txt b/gone.txt
deleted file mode 100644
--- a/gone.txt
+++ /dev/null
@@ -1 +0,0 @@
-bye
diff --git a/logo.png b/logo.png
new file mode 100644
Binary files /dev/null and b/logo.png differ
`;

describe("parseUnifiedDiff", () => {
  it("parses a modified file with line numbers", () => {
    const [file] = parseUnifiedDiff(MODIFIED);
    expect(file).toMatchObject({
      path: "src/a.ts",
      status: "modified",
      additions: 2,
      deletions: 1,
    });
    const lines = file.hunks[0].lines;
    expect(lines.map((line) => [line.kind, line.oldLine, line.newLine])).toEqual([
      ["context", 1, 1],
      ["del", 2, null],
      ["add", null, 2],
      ["add", null, 3],
      ["context", 3, 4],
    ]);
    expect(lines[2].text).toBe("const y = 3;");
    expect(file.hunks[0].header).toBe("export function a() {");
  });

  it("detects added, renamed, deleted and binary files", () => {
    const files = parseUnifiedDiff(ADDED_AND_RENAMED);
    expect(files.map((file) => [file.path, file.oldPath, file.status, file.binary])).toEqual([
      ["new.go", "new.go", "added", false],
      ["new/name.py", "old/name.py", "renamed", false],
      ["gone.txt", "gone.txt", "deleted", false],
      ["logo.png", "logo.png", "added", true],
    ]);
    expect(files[0].hunks[0].lines[1]).toMatchObject({ kind: "add", newLine: 2 });
  });

  it("ignores no-newline markers", () => {
    const [file] = parseUnifiedDiff(`${MODIFIED}\\ No newline at end of file\n`);
    expect(file.hunks[0].lines).toHaveLength(5);
  });
});
