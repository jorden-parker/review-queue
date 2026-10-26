import type { PullRequestRef } from "@/lib/types";

const NAME = "[A-Za-z0-9_.-]+";
const URL_FORM = new RegExp(`^https://github\\.com/(${NAME})/(${NAME})/pull/(\\d+)`);
const SHORT_FORM = new RegExp(`^(${NAME})/(${NAME})#(\\d+)$`);

function isSafeName(name: string): boolean {
  return name !== "." && name !== "..";
}

export function parsePullRequestRef(text: string): PullRequestRef | null {
  const trimmed = text.trim();
  const match = trimmed.match(URL_FORM) ?? trimmed.match(SHORT_FORM);
  if (!match || !isSafeName(match[1]) || !isSafeName(match[2])) return null;
  return { owner: match[1], repo: match[2], number: Number(match[3]) };
}

export function refFromParams(params: {
  owner: string;
  repo: string;
  number: string;
}): PullRequestRef | null {
  return parsePullRequestRef(`${params.owner}/${params.repo}#${params.number}`);
}

export function prKey(ref: PullRequestRef): string {
  return `${ref.owner}/${ref.repo}#${ref.number}`;
}

export function prPath(ref: PullRequestRef): string {
  return `/pr/${ref.owner}/${ref.repo}/${ref.number}`;
}
