import {
  ASSIST_ERROR_MARKER,
  ASSIST_LOOKUP_MARKER,
  type AssistLookup,
} from "@/lib/assist-protocol";

export type ParsedAssistStream = { text: string; lookups: AssistLookup[]; failure: string | null };

function isLookup(value: unknown): value is AssistLookup {
  if (typeof value !== "object" || value === null) return false;
  const { tool, label, paths } = value as Partial<Record<keyof AssistLookup, unknown>>;
  return (
    typeof tool === "string" &&
    typeof label === "string" &&
    Array.isArray(paths) &&
    paths.every((path) => typeof path === "string")
  );
}

function lookupOf(json: string): AssistLookup[] {
  try {
    const value: unknown = JSON.parse(json);
    return isLookup(value) ? [value] : [];
  } catch {
    return [];
  }
}

function splitFailure(raw: string): { body: string; failure: string | null } {
  const at = raw.indexOf(ASSIST_ERROR_MARKER);
  if (at === -1) return { body: raw, failure: null };
  return { body: raw.slice(0, at), failure: raw.slice(at + 1) };
}

export function parseAssistStream(raw: string): ParsedAssistStream {
  const { body, failure } = splitFailure(raw);
  const segments = body.split(ASSIST_LOOKUP_MARKER);
  const text = segments.filter((_, index) => index % 2 === 0).join("");
  const lookups = segments.flatMap((segment, index) =>
    index % 2 === 1 && index + 1 < segments.length ? lookupOf(segment) : [],
  );
  return { text, lookups, failure };
}
