const GENERAL_RULES = `Review the design as a senior engineer, not only what the code does:
- SOLID: each unit has one reason to change; depend on small interfaces, not concrete details, where it matters.
- KISS: is there a simpler way that does the same job?
- YAGNI: flag options, parameters, abstractions or branches that nothing needs yet.
- Logic that repeats an existing helper elsewhere in the repo, dead or unused code, unclear names, functions doing more than one thing.
- Errors handled at the boundaries; new behaviour covered by tests.
Prefer a few real problems over many nitpicks. Say which affect correctness and which are taste.
Do not invent problems: when the code is fine, say so.`;

const TYPESCRIPT_RULES = `TypeScript and JavaScript:
- No \`any\`, unchecked \`as\` casts or non-null \`!\`; narrow \`unknown\` instead.
- Discriminated unions over loose optional fields or boolean flags; exhaustive \`switch\` with \`never\`.
- Immutable updates; \`readonly\` where data should not change.
- Validate external data (requests, JSON, env) at the boundary, for example with zod.
- Every promise awaited or its rejection handled.`;

const REACT_RULES = `React:
- Rules of hooks; effect dependency lists complete; effects clean up what they start.
- Derive values during render instead of copying them into state or syncing them with effects.
- Stable \`key\`s, not array indexes on lists that reorder.
- Keep logic out of components, in pure modules or hooks; state no higher than needed.
- Memoize only where it measurably helps.
- Accessible markup: real buttons and labels, alt text; no \`dangerouslySetInnerHTML\`.`;

const TYPESCRIPT_EXTENSION = /\.(ts|tsx|mts|cts|js|jsx|mjs|cjs)$/i;
const REACT_EXTENSION = /\.(tsx|jsx)$/i;

export function reviewGuidance(paths: string[]): string {
  return [
    GENERAL_RULES,
    ...(paths.some((path) => TYPESCRIPT_EXTENSION.test(path)) ? [TYPESCRIPT_RULES] : []),
    ...(paths.some((path) => REACT_EXTENSION.test(path)) ? [REACT_RULES] : []),
  ].join("\n\n");
}
