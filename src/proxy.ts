import { NextResponse, type NextRequest } from "next/server";
import { loadAccessToken, matchesAccessToken } from "@/lib/access-token";

const LOOPBACK_HOSTS = new Set(["127.0.0.1", "localhost", "[::1]"]);
const TOKEN_COOKIE = "review-queue-token";
const TOKEN_PARAM = "token";
const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;
const ALLOWED_FETCH_SITES = new Set(["same-origin", "none"]);

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

function isCrossSiteFetch(request: NextRequest): boolean {
  const fetchSite = request.headers.get("sec-fetch-site");
  return fetchSite !== null && !ALLOWED_FETCH_SITES.has(fetchSite);
}

function isReadMethod(method: string): boolean {
  return method === "GET" || method === "HEAD";
}

function isAllowedRequest(request: NextRequest): boolean {
  if (isCrossSiteFetch(request)) return false;
  return isReadMethod(request.method) || isSameOriginJson(request);
}

function signInFromLink(request: NextRequest, token: string): NextResponse | null {
  if (!matchesAccessToken(request.nextUrl.searchParams.get(TOKEN_PARAM), token)) return null;
  const destination = new URL(request.url);
  destination.searchParams.delete(TOKEN_PARAM);
  destination.host = request.headers.get("host") ?? destination.host;
  const response = NextResponse.redirect(destination.toString());
  response.cookies.set(TOKEN_COOKIE, token, {
    httpOnly: true,
    sameSite: "strict",
    path: "/",
    maxAge: COOKIE_MAX_AGE_SECONDS,
  });
  return response;
}

function guard(request: NextRequest, token: string): NextResponse {
  if (!isLoopback(request.headers.get("host"))) {
    return new NextResponse("Forbidden", { status: 403 });
  }
  const signedIn = signInFromLink(request, token);
  if (signedIn) return signedIn;
  if (!matchesAccessToken(request.cookies.get(TOKEN_COOKIE)?.value, token)) {
    return new NextResponse("Open the review-queue link printed in the terminal.", {
      status: 401,
    });
  }
  if (!isAllowedRequest(request)) {
    return new NextResponse("Cross-site request refused", { status: 403 });
  }
  return NextResponse.next();
}

function forbidFraming(response: NextResponse): NextResponse {
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("Content-Security-Policy", "frame-ancestors 'none'");
  return response;
}

export function proxy(request: NextRequest) {
  return forbidFraming(guard(request, loadAccessToken()));
}
