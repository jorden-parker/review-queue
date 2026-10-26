import type { ReferenceWithCode } from "@/lib/review/peek-code";

export type ReferenceGroup = {
  path: string;
  inPullRequest: boolean;
  references: ReferenceWithCode[];
};

export function groupReferencesByFile(
  references: ReferenceWithCode[],
  inPullRequest: (path: string) => boolean,
): ReferenceGroup[] {
  const groups = new Map<string, ReferenceGroup>();
  for (const reference of references) {
    const group = groups.get(reference.path) ?? {
      path: reference.path,
      inPullRequest: inPullRequest(reference.path),
      references: [],
    };
    group.references.push(reference);
    groups.set(reference.path, group);
  }
  return [...groups.values()].sort(
    (first, second) => Number(second.inPullRequest) - Number(first.inPullRequest),
  );
}
