const RULE_CHECKS: Record<string, string[]> = {
  "runs-commands": [
    "Trace every argument back to where it comes from.",
    "Prefer an argument array over a shell string.",
    "Check what happens if the command fails or hangs.",
  ],
  "sql-strings": [
    "Find where each interpolated value comes from.",
    "Switch to placeholders or the query builder.",
  ],
  "hardcoded-secret": [
    "Is this a real credential or a test value?",
    "Load it from the environment or a secret store.",
    "If it is real, it needs rotating now.",
  ],
  "raw-html": [
    "Can any part of this HTML come from a user?",
    "Is it sanitised before it is inserted?",
  ],
  "auth-crypto": [
    "Check both the allowed and the denied path.",
    "Look for a missing or inverted check.",
    "Is there a test for the denied case?",
  ],
  concurrency: [
    "What runs at the same time as this?",
    "What happens if one of the tasks fails?",
    "Is shared state touched without a lock?",
  ],
  "swallowed-error": [
    "Should this error be logged or passed up?",
    "What state is left behind when it fails?",
  ],
  "magic-value": [
    "Is the number explained anywhere?",
    "Would a named constant or a setting be clearer?",
  ],
  todo: ["Is there an issue tracking this?", "Should it block the merge?"],
  "debug-output": ["Remove it, or switch to the project's logger.", "Could it log secrets?"],
  suppression: [
    "Read what the checker complains about.",
    "Can the code change so the suppression is not needed?",
  ],
  "commented-code": ["Delete it; git history keeps it."],
  "signature-change": [
    "Open the references and check each caller.",
    "Do default values keep old callers working?",
  ],
  "big-hunk": ["Skim it once for shape, then read it in parts.", "Could it be split up?"],
  branching: ["List the paths and find a test for each.", "Is there a missing else?"],
  migration: [
    "Can it be rolled back?",
    "Will it lock a big table?",
    "Does the code still work before and after it runs?",
  ],
  dependencies: [
    "Is the new package maintained and trusted?",
    "Check the licence and the size it adds.",
  ],
  "lockfile-drift": ["Ask whether this change was intended."],
  churn: ["Look for the bugs this file had before.", "Is this change covered by tests?"],
  "tests-removed": [
    "Was the behaviour removed too?",
    "If not, the tests should come back or be replaced.",
  ],
  "no-tests": ["Which behaviour changed?", "Ask for a test that would fail without this change."],
};

export function checksFor(rule: string): string[] {
  return RULE_CHECKS[rule] ?? [];
}
