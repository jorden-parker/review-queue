import { languageFor } from "@/lib/symbols/languages";
import { diffCheckout, ensureCheckout, fileChurn, type CheckoutOptions } from "@/lib/git/checkout";
import type { PullRequest } from "@/lib/github/gh";
import { highlightFile, type HighlightedHunk } from "@/lib/highlight";
import { findHotspots } from "@/lib/hotspots/find-hotspots";
import { changedSignatureNames } from "@/lib/hotspots/rules";
import { buildReadingPath, estimateMinutes } from "@/lib/plan/reading-path";
import { prKey } from "@/lib/pr-ref";
import type { Session, SessionStore } from "@/lib/session/store";
import { SymbolIndex } from "@/lib/symbols/symbol-index";
import type { FileDiff, Hotspot, PullRequestRef, Step } from "@/lib/types";

export type ReviewDeps = {
  fetchPullRequest: (ref: PullRequestRef) => Promise<PullRequest>;
  store: SessionStore;
  checkoutOptions?: CheckoutOptions;
};

export type PreparedFile = FileDiff & { highlighted: HighlightedHunk[]; navigable: boolean };

export type ReviewData = {
  pr: PullRequest;
  headSha: string;
  files: PreparedFile[];
  steps: Step[];
  startStepId: string | null;
  hotspots: Hotspot[];
  linkableNames: string[];
  estimateMinutes: number;
};

export type PreparedReview = {
  data: ReviewData;
  index: SymbolIndex;
  changedSince: (sha: string) => Promise<string[]>;
};

export type ReviewPayload = ReviewData & {
  session: Session;
  reopenedStepIds: string[];
};

const IDENTIFIER = /[A-Za-z_$][\w$]*/g;
const globals = globalThis as { reviewQueuePrepared?: Map<string, Promise<PreparedReview>> };
const prepared = (globals.reviewQueuePrepared ??= new Map());

function linkableNames(diffs: FileDiff[], index: SymbolIndex): string[] {
  const names = new Set<string>();
  const parsed = diffs.filter((diff) => languageFor(diff.path) !== null);
  for (const line of parsed.flatMap((diff) => diff.hunks.flatMap((hunk) => hunk.lines))) {
    for (const match of line.text.matchAll(IDENTIFIER)) {
      if (index.hasName(match[0])) names.add(match[0]);
    }
  }
  return [...names].sort();
}

async function callerCounts(diffs: FileDiff[], index: SymbolIndex): Promise<Map<string, number>> {
  const counts = new Map<string, number>();
  for (const name of changedSignatureNames(diffs)) {
    counts.set(name, Math.max(0, (await index.referencesTo(name)).length - 1));
  }
  return counts;
}

function orderFiles(files: PreparedFile[], steps: Step[]): PreparedFile[] {
  const order = steps.flatMap((step) => step.files.map((file) => file.path));
  return [...files].sort((a, b) => order.indexOf(a.path) - order.indexOf(b.path));
}

async function build(pr: PullRequest, deps: ReviewDeps): Promise<PreparedReview> {
  const checkout = await ensureCheckout(
    pr.ref,
    { branch: pr.baseRef, sha: pr.baseSha },
    deps.checkoutOptions,
  );
  const diffs = await diffCheckout(checkout);
  const index = await SymbolIndex.build(checkout.worktreePath, checkout.run);
  const { steps, startStepId } = buildReadingPath(diffs, index);
  const hotspots = findHotspots(diffs, {
    churn: await fileChurn(checkout),
    callerCounts: await callerCounts(diffs, index),
  });
  const files = await Promise.all(
    diffs.map(async (diff) => ({
      ...diff,
      highlighted: await highlightFile(diff),
      navigable: languageFor(diff.path) !== null,
    })),
  );
  const data: ReviewData = {
    pr,
    headSha: checkout.headSha,
    files: orderFiles(files, steps),
    steps,
    startStepId,
    hotspots,
    linkableNames: linkableNames(diffs, index),
    estimateMinutes: estimateMinutes(steps.reduce((sum, step) => sum + step.changedLines, 0)),
  };
  return {
    data,
    index,
    changedSince: async (sha) =>
      (await diffCheckout(checkout, sha).catch(() => diffs)).map((diff) => diff.path),
  };
}

function cacheKey(ref: PullRequestRef, headSha: string): string {
  return `${prKey(ref)}@${headSha}`;
}

export function findPrepared(ref: PullRequestRef, headSha: string): Promise<PreparedReview> | null {
  return prepared.get(cacheKey(ref, headSha)) ?? null;
}

function preparedReview(pr: PullRequest, deps: ReviewDeps): Promise<PreparedReview> {
  const key = cacheKey(pr.ref, pr.headSha);
  if (!prepared.has(key)) {
    const pending = build(pr, deps);
    pending.catch(() => prepared.delete(key));
    prepared.set(key, pending);
  }
  return prepared.get(key)!;
}

async function reopenChangedSteps(review: PreparedReview, store: SessionStore): Promise<string[]> {
  const key = prKey(review.data.pr.ref);
  const session = store.getSession(key);
  if (!session.lastHeadSha || session.lastHeadSha === review.data.headSha) return [];
  const changed = new Set(await review.changedSince(session.lastHeadSha));
  const reopened = review.data.steps
    .filter((step) => session.doneSteps.includes(step.id))
    .filter((step) => step.files.some((file) => changed.has(file.path)))
    .map((step) => step.id);
  for (const id of reopened) store.setStepDone(key, id, false);
  return reopened;
}

export async function loadReview(ref: PullRequestRef, deps: ReviewDeps): Promise<ReviewPayload> {
  const pr = await deps.fetchPullRequest(ref);
  const review = await preparedReview(pr, deps);
  const reopenedStepIds = await reopenChangedSteps(review, deps.store);
  deps.store.markSeen(prKey(ref), review.data.headSha);
  return { ...review.data, session: deps.store.getSession(prKey(ref)), reopenedStepIds };
}
