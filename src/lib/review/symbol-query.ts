import { z } from "zod";
import type { SymbolPosition } from "@/lib/types";
import type { PreparedFile, PreparedReview } from "./prepare";
import { jsonError, withPreparedReview } from "./route-context";

const POSITION = z.object({
  name: z.string().min(1),
  path: z.string().default(""),
  line: z.coerce.number().int().positive().default(1),
  character: z.coerce.number().int().nonnegative().default(0),
  side: z.enum(["old", "new"]).default("old"),
});

export function positionFromQuery(params: URLSearchParams): SymbolPosition | null {
  const parsed = POSITION.safeParse(Object.fromEntries(params));
  return parsed.success ? parsed.data : null;
}

type SymbolLookup = (prepared: PreparedReview, position: SymbolPosition) => Promise<unknown>;

export function symbolLookupRoute(lookup: SymbolLookup) {
  return withPreparedReview(async (request, prepared) => {
    const position = positionFromQuery(new URL(request.url).searchParams);
    if (!position) return jsonError("Missing or invalid symbol position", 400);
    return Response.json(await lookup(prepared, position));
  });
}

type FileLookup = (prepared: PreparedReview, file: PreparedFile) => Promise<unknown> | unknown;

export function fileLookupRoute(lookup: FileLookup) {
  return withPreparedReview(async (request, prepared) => {
    const path = new URL(request.url).searchParams.get("path");
    const file = prepared.data.files.find((candidate) => candidate.path === path);
    if (!file) return jsonError("That file is not part of this review", 400);
    return Response.json(await lookup(prepared, file));
  });
}
