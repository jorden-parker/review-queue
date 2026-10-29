import { randomBytes, timingSafeEqual } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { dataDirectory } from "@/lib/data-directory";

const APP_ORIGIN = "http://127.0.0.1:4477";
const TOKEN_BYTES = 32;

function accessTokenPath(): string {
  return process.env.REVIEW_QUEUE_TOKEN_FILE ?? path.join(dataDirectory(), "access-token");
}

function createAccessToken(file: string): string {
  fs.mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 });
  const token = randomBytes(TOKEN_BYTES).toString("base64url");
  fs.writeFileSync(file, token, { mode: 0o600, flag: "wx" });
  return token;
}

const GROUP_OR_OTHER_BITS = 0o077;

function keepPrivate(file: string): void {
  if ((fs.statSync(file).mode & GROUP_OR_OTHER_BITS) !== 0) fs.chmodSync(file, 0o600);
}

export function loadAccessToken(file = accessTokenPath()): string {
  if (!fs.existsSync(file)) return createAccessToken(file);
  keepPrivate(file);
  return fs.readFileSync(file, "utf8").trim();
}

export function matchesAccessToken(candidate: string | null | undefined, token: string): boolean {
  if (!candidate) return false;
  const given = Buffer.from(candidate);
  const expected = Buffer.from(token);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

export function accessLink(token: string): string {
  return `${APP_ORIGIN}/?token=${token}`;
}
