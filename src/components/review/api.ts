import type { ReviewEvent } from "@/lib/github/gh";
import { prPath } from "@/lib/pr-ref";
import type { ExplanationResult } from "@/lib/review/explanation-service";
import type { OrientationResult } from "@/lib/review/orientation-service";
import type { ReviewPayload } from "@/lib/review/prepare";
import type { SessionAction } from "@/lib/review/session-actions";
import type { Session } from "@/lib/session/store";
import type { DefinitionWithCode, ReferenceWithCode } from "@/lib/review/peek-code";
import type { PullRequestRef } from "@/lib/types";

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

export function fetchDefinitions(
  ref: PullRequestRef,
  sha: string,
  name: string,
  from: string,
): Promise<DefinitionWithCode[]> {
  return fetch(apiPath(ref, `/definitions${query({ sha, name, from })}`)).then(
    json<DefinitionWithCode[]>,
  );
}

export function fetchReferences(
  ref: PullRequestRef,
  sha: string,
  name: string,
): Promise<ReferenceWithCode[]> {
  return fetch(apiPath(ref, `/references${query({ sha, name })}`)).then(json<ReferenceWithCode[]>);
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
