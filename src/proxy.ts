import { NextResponse, type NextRequest } from "next/server";

const LOOPBACK_HOSTS = new Set(["127.0.0.1", "localhost", "[::1]"]);

function hostName(host: string | null): string | null {
  if (!host) return null;
  return host.startsWith("[") ? host.slice(0, host.indexOf("]") + 1) : host.split(":")[0];
}

function isLoopback(host: string | null): boolean {
  const name = hostName(host);
  return name !== null && LOOPBACK_HOSTS.has(name);
}

function originHost(origin: string | null): string | null {
  if (!origin || !URL.canParse(origin)) return null;
  return new URL(origin).host;
}

function isSameOriginJson(request: NextRequest): boolean {
  const host = request.headers.get("host");
  const sameOrigin = isLoopback(host) && originHost(request.headers.get("origin")) === host;
  const json = request.headers.get("content-type")?.startsWith("application/json") ?? false;
  return sameOrigin && json;
}

export function proxy(request: NextRequest) {
  if (!isLoopback(request.headers.get("host"))) {
    return new NextResponse("Forbidden", { status: 403 });
  }
  if (request.method !== "GET" && request.method !== "HEAD" && !isSameOriginJson(request)) {
    return new NextResponse("Cross-site request refused", { status: 403 });
  }
  return NextResponse.next();
}
