import { ASSIST_ERROR_MARKER } from "@/lib/assist-protocol";
import type { ReviewEvent } from "@/lib/github/gh";
import { prPath } from "@/lib/pr-ref";
import type { AssistRequest } from "@/lib/review/assist-request";
import type { ExplanationResult } from "@/lib/review/explanation-service";
import type { OrientationResult } from "@/lib/review/orientation-service";
import type { ReviewPayload } from "@/lib/review/prepare";
import type { SessionAction } from "@/lib/review/session-actions";
import type { SummaryDraftResult } from "@/lib/review/summary-draft-service";
import type { Session } from "@/lib/session/store";
import type { DefinitionWithCode, ReferenceWithCode } from "@/lib/review/peek-code";
import type { OutlineSymbol, PullRequestRef, ReferenceCount, SymbolPosition } from "@/lib/types";

export type SubmitInput = {
  event: ReviewEvent;
  summary: string;
  noteIds: number[];
  headSha: string;
};

async function json<T>(response: Response): Promise<T> {
  const body = await response.json();
  if (!response.ok) throw new Error(body.error ?? `Request failed (${response.status})`);
  return body as T;
}

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

export function fetchStepExplanation(
  ref: PullRequestRef,
  sha: string,
  stepId: string,
): Promise<ExplanationResult> {
  return fetch(apiPath(ref, `/explanation${query({ sha, step: stepId })}`)).then(
    json<ExplanationResult>,
  );
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

function post<T>(url: string, body: unknown): Promise<T> {
  return fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  }).then(json<T>);
}

export function sendSessionAction(ref: PullRequestRef, action: SessionAction): Promise<Session> {
  return post<Session>(apiPath(ref, "/session"), action);
}

export function submitReviewRequest(ref: PullRequestRef, input: SubmitInput): Promise<Session> {
  return post<Session>(apiPath(ref, "/submit"), input);
}

export function requestSummaryDraft(
  ref: PullRequestRef,
  sha: string,
  input: { event: ReviewEvent; noteIds: number[] },
): Promise<SummaryDraftResult> {
  return post<SummaryDraftResult>(apiPath(ref, `/summary-draft${query({ sha })}`), input);
}

async function readText(
  body: ReadableStream<Uint8Array>,
  onText: (text: string) => void,
): Promise<string> {
  const decoder = new TextDecoder();
  const reader = body.getReader();
  let text = "";
  for (let read = await reader.read(); !read.done; read = await reader.read()) {
    text += decoder.decode(read.value, { stream: true });
    onText(text.split(ASSIST_ERROR_MARKER)[0]);
  }
  return text;
}

export async function streamAssist(
  ref: PullRequestRef,
  sha: string,
  request: AssistRequest,
  onText: (text: string) => void,
  signal: AbortSignal,
): Promise<void> {
  const response = await fetch(apiPath(ref, `/assist${query({ sha })}`), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(request),
    signal,
  });
  if (!response.ok) await json(response);
  if (!response.body) return;
  const text = await readText(response.body, onText);
  const [, failure] = text.split(ASSIST_ERROR_MARKER);
  if (failure !== undefined) throw new Error(failure);
}
