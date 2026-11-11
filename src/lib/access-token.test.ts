import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { accessLink, loadAccessToken, matchesAccessToken } from "./access-token";

describe("access token", () => {
  let directory: string;

  beforeEach(() => {
    directory = fs.mkdtempSync(path.join(os.tmpdir(), "access-token-"));
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    fs.rmSync(directory, { recursive: true, force: true });
  });

  it("creates a private random token once and reuses it", () => {
    const file = path.join(directory, "nested", "access-token");
    const token = loadAccessToken(file);
    expect(token).toMatch(/^[\w-]{43}$/);
    expect(fs.statSync(file).mode & 0o777).toBe(0o600);
    expect(loadAccessToken(file)).toBe(token);
  });

  it("tightens a token file that other accounts could read", () => {
    const file = path.join(directory, "access-token");
    fs.writeFileSync(file, "shared-token", { mode: 0o644 });
    expect(loadAccessToken(file)).toBe("shared-token");
    expect(fs.statSync(file).mode & 0o777).toBe(0o600);
  });

  it("matches only the exact token", () => {
    expect(matchesAccessToken("secret-token", "secret-token")).toBe(true);
    expect(matchesAccessToken("secret-tokem", "secret-token")).toBe(false);
    expect(matchesAccessToken("secret", "secret-token")).toBe(false);
    expect(matchesAccessToken(null, "secret-token")).toBe(false);
  });

  it("builds the link that signs the browser in on the app's own host name", () => {
    expect(accessLink("abc")).toBe("http://review-queue.localhost:4477/?token=abc");
  });

  it("starts a fresh token instead of reusing one issued for the 127.0.0.1 address", () => {
    vi.stubEnv("HOME", directory);
    vi.stubEnv("REVIEW_QUEUE_TOKEN_FILE", undefined);
    const formerFile = path.join(directory, ".local", "share", "review-queue", "access-token");
    fs.mkdirSync(path.dirname(formerFile), { recursive: true });
    fs.writeFileSync(formerFile, "former-token", { mode: 0o600 });
    expect(loadAccessToken()).not.toBe("former-token");
  });
});
