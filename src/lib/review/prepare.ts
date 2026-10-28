import { languageFor } from "@/lib/symbols/languages";
import { diffCheckout, ensureCheckout, fileChurn, type CheckoutOptions } from "@/lib/git/checkout";
import type { PullRequest } from "@/lib/github/gh";
import { highlightFile, type HighlightedHunk } from "@/lib/highlight";
import { findHotspots } from "@/lib/hotspots/find-hotspots";
import { changedSignatureNames } from "@/lib/hotspots/rules";
import { buildChangeMap } from "@/lib/map/change-map";
import { memoizePromise } from "@/lib/memoize-promise";
import { buildReadingPath, estimateMinutes } from "@/lib/plan/reading-path";
import { prKey } from "@/lib/pr-ref";
import type { Session, SessionStore } from "@/lib/session/store";
import { SymbolIndex } from "@/lib/symbols/symbol-index";
import { languageClients, type ClientFor } from "@/lib/lsp/pool";
import type {
  ChangeMap,
  FileDiff,
  Hotspot,
  PullRequestRef,
  Step,
  SymbolDefinition,
  SymbolKind,
} from "@/lib/types";

export type ReviewDeps = {
  fetchPullRequest: (ref: PullRequestRef) => Promise<PullRequest>;
  store: SessionStore;
  checkoutOptions?: CheckoutOptions;
  languageClients?: typeof languageClients;
};

export type PreparedFile = FileDiff & { highlighted: HighlightedHunk[]; navigable: boolean };

export type ReviewData = {
  pr: PullRequest;
  headSha: string;
  files: PreparedFile[];
  steps: Step[];
  startStepId: string | null;
  hotspots: Hotspot[];
  estimateMinutes: number;
  changeMap: ChangeMap;
};

export type PreparedReview = {
  data: ReviewData;
  index: SymbolIndex;
  clientFor: ClientFor;
  diffFrom: (sha: string) => Promise<FileDiff[]>;
};

export type ReviewPayload = ReviewData & {
  session: Session;
  reopenedStepIds: string[];
};

export type SeenResult = { session: Session; reopenedStepIds: string[] };

const globals = globalThis as { reviewQueuePrepared?: Map<string, Promise<PreparedReview>> };
const prepared = (globals.reviewQueuePrepared ??= new Map());
const MAX_HEADS_PER_PULL_REQUEST = 2;

function warmLanguageServers(clientFor: ClientFor, files: PreparedFile[]): void {
  for (const file of files.filter(
    (candidate) => candidate.navigable && candidate.status !== "deleted",
  ))
    void clientFor(file.path);
}

const COUNTABLE_KINDS = new Set<SymbolKind>(["function", "method"]);
const MAX_COUNTED_NAMES = 40;

function addedLineNumbers(file: FileDiff): number[] {
  return file.hunks
    .flatMap((hunk) => hunk.lines)
    .flatMap((line) => (line.kind === "add" && line.newLine !== null ? [line.newLine] : []));
}

function spansAnyLine(definition: SymbolDefinition, lines: number[]): boolean {
  return lines.some((line) => line >= definition.line && line <= definition.endLine);
}

function touchedDefinitions(
  diffs: FileDiff[],
  index: SymbolIndex,
): Map<string, SymbolDefinition[]> {
  const touched = new Map<string, SymbolDefinition[]>();
  for (const file of diffs) {
    if (file.status === "deleted") continue;
    const lines = addedLineNumbers(file);
    const definitions = index
      .definitionsIn(file.path)
      .filter((definition) => COUNTABLE_KINDS.has(definition.kind))
      .filter((definition) => spansAnyLine(definition, lines));
    if (definitions.length > 0) touched.set(file.path, definitions);
  }
  return touched;
}

function namesToCount(diffs: FileDiff[], touched: Map<string, SymbolDefinition[]>): string[] {
  const touchedNames = [...touched.values()].flat().map((definition) => definition.name);
  return [...new Set([...changedSignatureNames(diffs), ...touchedNames])].slice(
    0,
    MAX_COUNTED_NAMES,
  );
}

async function callerCounts(names: string[], index: SymbolIndex): Promise<Map<string, number>> {
  const counts = new Map<string, number>();
  for (const name of names) {
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
    { baseBranch: pr.baseRef, baseSha: pr.baseSha, headSha: pr.headSha },
    deps.checkoutOptions,
  );
  const diffs = await diffCheckout(checkout);
  const index = await SymbolIndex.build(checkout.worktreePath, checkout.run);
  const { steps, startStepId } = buildReadingPath(diffs, index);
  const touched = touchedDefinitions(diffs, index);
  const changeMap = buildChangeMap(diffs, index, steps);
  const hotspots = findHotspots(diffs, {
    churn: await fileChurn(checkout),
    callerCounts: await callerCounts(namesToCount(diffs, touched), index),
    touchedDefinitions: touched,
  });
  const files = await prepareFiles(diffs);
  const data: ReviewData = {
    pr,
    headSha: checkout.headSha,
    files: orderFiles(files, steps),
    steps,
    startStepId,
    hotspots,
    estimateMinutes: estimateMinutes(steps.reduce((sum, step) => sum + step.changedLines, 0)),
    changeMap,
  };
  const clientFor = (deps.languageClients ?? languageClients)(index.root, (file) =>
    index.readFile(file),
  );
  warmLanguageServers(clientFor, files);
  return {
    data,
    index,
    clientFor,
    diffFrom: (sha) => diffCheckout(checkout, sha).catch(() => diffs),
  };
}

export function prepareFiles(diffs: FileDiff[]): Promise<PreparedFile[]> {
  return Promise.all(
    diffs.map(async (diff) => ({
      ...diff,
      highlighted: await highlightFile(diff),
      navigable: languageFor(diff.path) !== null,
    })),
  );
}

function cacheKey(ref: PullRequestRef, headSha: string): string {
  return `${prKey(ref)}@${headSha}`;
}

export function findPrepared(ref: PullRequestRef, headSha: string): Promise<PreparedReview> | null {
  return prepared.get(cacheKey(ref, headSha)) ?? null;
}

function headKeysOf(ref: PullRequestRef): string[] {
  const prefix = `${prKey(ref)}@`;
  return [...prepared.keys()].filter((key) => key.startsWith(prefix));
}

function forgetSupersededHeads(ref: PullRequestRef): void {
  const keys = headKeysOf(ref);
  for (const key of keys.slice(0, Math.max(0, keys.length - MAX_HEADS_PER_PULL_REQUEST))) {
    prepared.delete(key);
  }
}

function preparedReview(pr: PullRequest, deps: ReviewDeps): Promise<PreparedReview> {
  const review = memoizePromise(prepared, cacheKey(pr.ref, pr.headSha), () => build(pr, deps));
  forgetSupersededHeads(pr.ref);
  return review;
}

async function reopenChangedSteps(review: PreparedReview, store: SessionStore): Promise<string[]> {
  const key = prKey(review.data.pr.ref);
  const session = store.getSession(key);
  if (!session.lastHeadSha || session.lastHeadSha === review.data.headSha) return [];
  const changed = new Set((await review.diffFrom(session.lastHeadSha)).map((diff) => diff.path));
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
  return { ...review.data, pr, session: deps.store.getSession(prKey(ref)), reopenedStepIds: [] };
}

export async function markReviewSeen(
  ref: PullRequestRef,
  headSha: string,
  store: SessionStore,
): Promise<SeenResult | null> {
  const pending = findPrepared(ref, headSha);
  if (!pending) return null;
  const review = await pending;
  const key = prKey(ref);
  const reopenedStepIds = await reopenChangedSteps(review, store);
  store.markSeen(key, headSha);
  store.rememberTitle(key, review.data.pr.title);
  return { session: store.getSession(key), reopenedStepIds };
}
