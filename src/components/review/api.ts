import type { Conversation } from "@/lib/github/conversation";
import type { ReviewEvent } from "@/lib/github/gh";
import { json, postJson } from "@/lib/json-response";
import { prPath } from "@/lib/pr-ref";
import type { AssistRequest } from "@/lib/review/assist-request";
import type { ChangePartsResult } from "@/lib/review/change-parts-service";
import type { ExplanationResult } from "@/lib/review/explanation-service";
import type { FileLines } from "@/lib/review/file-lines";
import type { Interdiff } from "@/lib/review/interdiff";
import type { OrientationResult } from "@/lib/review/orientation-service";
import type { ReviewPayload, SeenResult } from "@/lib/review/prepare";
import type { SessionAction } from "@/lib/review/session-actions";
import type { SummaryDraftResult } from "@/lib/review/summary-draft-service";
import type { Session } from "@/lib/session/store";
import type { DefinitionWithCode, ReferenceWithCode } from "@/lib/review/peek-code";
import type { Reference } from "@/lib/symbols/symbol-index";
import type { OutlineSymbol, PullRequestRef, ReferenceCount, SymbolPosition } from "@/lib/types";
import { type ParsedAssistStream, parseAssistStream } from "./assist-stream";

export type SubmitInput = {
  event: ReviewEvent;
  summary: string;
  noteIds: number[];
  headSha: string;
};

function apiPath(ref: PullRequestRef, suffix = ""): string {
  return `/api${prPath(ref)}${suffix}`;
}

function query(params: Record<string, string>): string {
  return `?${new URLSearchParams(params)}`;
}

export function fetchReview(ref: PullRequestRef): Promise<ReviewPayload> {
  return fetch(apiPath(ref)).then(json<ReviewPayload>);
}

export function fetchOrientation(ref: PullRequestRef, sha: string): Promise<OrientationResult> {
  return fetch(apiPath(ref, `/orientation${query({ sha })}`)).then(json<OrientationResult>);
}

export function fetchHead(ref: PullRequestRef): Promise<{ headSha: string }> {
  return fetch(apiPath(ref, "/head")).then(json<{ headSha: string }>);
}

export function fetchConversation(ref: PullRequestRef): Promise<Conversation> {
  return fetch(apiPath(ref, "/conversation")).then(json<Conversation>);
}

export function fetchChanges(ref: PullRequestRef, sha: string): Promise<Interdiff> {
  return fetch(apiPath(ref, `/changes${query({ sha })}`)).then(json<Interdiff>);
}

export function fetchStepExplanation(
  ref: PullRequestRef,
  sha: string,
  stepId: string,
): Promise<ExplanationResult> {
  return fetch(apiPath(ref, `/explanation${query({ sha, step: stepId })}`)).then(
    json<ExplanationResult>,
  );
}

export function fetchChangeParts(ref: PullRequestRef, sha: string): Promise<ChangePartsResult> {
  return fetch(apiPath(ref, `/map-parts${query({ sha })}`)).then(json<ChangePartsResult>);
}

function positionQuery(sha: string, position: SymbolPosition): string {
  const { name, path, line, character, side } = position;
  return query({ sha, name, path, line: String(line), character: String(character), side });
}

export function fetchDefinitions(
  ref: PullRequestRef,
  sha: string,
  position: SymbolPosition,
): Promise<DefinitionWithCode[]> {
  return fetch(apiPath(ref, `/definitions${positionQuery(sha, position)}`)).then(
    json<DefinitionWithCode[]>,
  );
}

export function fetchReferences(
  ref: PullRequestRef,
  sha: string,
  position: SymbolPosition,
): Promise<ReferenceWithCode[]> {
  return fetch(apiPath(ref, `/references${positionQuery(sha, position)}`)).then(
    json<ReferenceWithCode[]>,
  );
}

export function fetchReferenceCounts(
  ref: PullRequestRef,
  sha: string,
  path: string,
): Promise<ReferenceCount[]> {
  return fetch(apiPath(ref, `/reference-counts${query({ sha, path })}`)).then(
    json<ReferenceCount[]>,
  );
}

export function fetchOutline(
  ref: PullRequestRef,
  sha: string,
  path: string,
): Promise<OutlineSymbol[]> {
  return fetch(apiPath(ref, `/outline${query({ sha, path })}`)).then(json<OutlineSymbol[]>);
}

export function fetchFileLines(ref: PullRequestRef, sha: string, path: string): Promise<FileLines> {
  return fetch(apiPath(ref, `/file${query({ sha, path })}`)).then(json<FileLines>);
}

export function fetchWorktreeFiles(ref: PullRequestRef, sha: string): Promise<{ paths: string[] }> {
  return fetch(apiPath(ref, `/files${query({ sha })}`)).then(json<{ paths: string[] }>);
}

export function fetchSearch(
  ref: PullRequestRef,
  sha: string,
  searchText: string,
): Promise<{ results: Reference[] }> {
  return fetch(apiPath(ref, `/search${query({ sha, q: searchText })}`)).then(
    json<{ results: Reference[] }>,
  );
}

export function sendSessionAction(ref: PullRequestRef, action: SessionAction): Promise<Session> {
  return postJson<Session>(apiPath(ref, "/session"), action);
}

export function postSeen(ref: PullRequestRef, sha: string): Promise<SeenResult> {
  return postJson<SeenResult>(apiPath(ref, `/seen${query({ sha })}`), {});
}

export function submitReviewRequest(ref: PullRequestRef, input: SubmitInput): Promise<Session> {
  return postJson<Session>(apiPath(ref, "/submit"), input);
}

export type ReplyInput = { commentId: number; body: string };

export function sendReply(ref: PullRequestRef, input: ReplyInput): Promise<Session> {
  return postJson<Session>(apiPath(ref, "/reply"), input);
}

export function requestSummaryDraft(
  ref: PullRequestRef,
  sha: string,
  input: { event: ReviewEvent; noteIds: number[] },
): Promise<SummaryDraftResult> {
  return postJson<SummaryDraftResult>(apiPath(ref, `/summary-draft${query({ sha })}`), input);
}

async function readAssistStream(
  body: ReadableStream<Uint8Array>,
  onUpdate: (parsed: ParsedAssistStream) => void,
): Promise<ParsedAssistStream> {
  const decoder = new TextDecoder();
  const reader = body.getReader();
  let raw = "";
  for (let read = await reader.read(); !read.done; read = await reader.read()) {
    raw += decoder.decode(read.value, { stream: true });
    onUpdate(parseAssistStream(raw));
  }
  return parseAssistStream(raw);
}

async function failureMessage(response: Response): Promise<string> {
  const fallback = `The local model request failed (HTTP ${response.status})`;
  return response.json().then(
    (body: { error?: unknown } | null) => (typeof body?.error === "string" ? body.error : fallback),
    () => fallback,
  );
}

export async function streamAssist(
  ref: PullRequestRef,
  sha: string,
  request: AssistRequest,
  onUpdate: (parsed: ParsedAssistStream) => void,
  signal: AbortSignal,
): Promise<void> {
  const response = await fetch(apiPath(ref, `/assist${query({ sha })}`), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(request),
    signal,
  });
  if (!response.ok) throw new Error(await failureMessage(response));
  if (!response.body) throw new Error(`The local model sent no answer (HTTP ${response.status})`);
  const parsed = await readAssistStream(response.body, onUpdate);
  if (parsed.failure !== null) throw new Error(parsed.failure);
}
