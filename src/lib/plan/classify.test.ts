import { describe, expect, it } from "vitest";
import { classifyFile } from "./classify";

describe("classifyFile", () => {
  it.each([
    ["pnpm-lock.yaml", "generated"],
    ["go.sum", "generated"],
    ["api/gen/client.pb.go", "generated"],
    ["dist/bundle.min.js", "generated"],
    ["src/__snapshots__/a.test.ts.snap", "generated"],
    ["src/types.ts", "types"],
    ["src/user.d.ts", "types"],
    ["db/schema.prisma", "types"],
    ["proto/user.proto", "types"],
    ["src/models/user.go", "types"],
    ["src/cache.test.ts", "test"],
    ["pkg/cache_test.go", "test"],
    ["tests/test_cache.py", "test"],
    ["src/app/page.tsx", "caller"],
    ["cmd/server/main.go", "caller"],
    ["src/routes/user.ts", "caller"],
    ["package.json", "config"],
    [".github/workflows/ci.yml", "config"],
    ["Dockerfile", "config"],
    ["README.md", "docs"],
    ["docs/setup.md", "docs"],
    ["src/cache.ts", "core"],
  ])("%s is %s", (file, role) => {
    expect(classifyFile(file)).toBe(role);
  });
});
