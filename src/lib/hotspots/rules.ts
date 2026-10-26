import { plural } from "@/lib/plural";
import type { DiffLine, FileDiff, Hotspot, Severity } from "@/lib/types";
import { classifyFile } from "@/lib/plan/classify";

export type HotspotContext = {
  diffs: FileDiff[];
  churn: Map<string, number>;
  callerCounts: Map<string, number>;
};

export type Rule = (file: FileDiff, context: HotspotContext) => Hotspot[];

type Pattern = { rule: string; severity: Severity; pattern: RegExp; title: string; why: string };

const DEFINITION =
  /\b(?:function|func|def|fn|class|interface|type|struct)\s+(?:\([^)]*\)\s*)?([A-Za-z_$][\w$]*)/;
const BRANCH = /\b(if|else if|elif|for|while|switch|case|catch|except|match)\b|\?\?|\s\?\s/;
const HUNK_SIZE_LIMIT = 80;
const BRANCH_LIMIT = 6;
const CHURN_LIMIT = 20;
const CHURN_TOP_SHARE = 0.05;
const CHURN_ROLES = new Set(["core", "caller", "types"]);
const BUSY_CALLER_LIMIT = 3;
const MANIFESTS =
  /(^|\/)(package\.json|go\.mod|Cargo\.toml|pyproject\.toml|requirements[^/]*\.txt|Gemfile)$/;
const LOCKFILES =
  /(^|\/)(pnpm-lock\.yaml|package-lock\.json|yarn\.lock|bun\.lockb?|go\.sum|Cargo\.lock|poetry\.lock|uv\.lock)$/;
const MIGRATIONS = /(^|\/)migrations?\/|\.sql$|schema\.prisma$/;
const TEST_CASE = /\b(it|test|describe)\s*\(|\bfunc Test\w+|\bdef test_\w+/;

const CODE_PATTERNS: Pattern[] = [
  {
    rule: "runs-commands",
    severity: "high",
    pattern:
      /\b(eval|exec|execSync|execFile|spawn|child_process|subprocess|os\.system|exec\.Command)\b/,
    title: "Runs code or shell commands",
    why: "Check that no user input reaches the command unescaped.",
  },
  {
    rule: "sql-strings",
    severity: "high",
    pattern: /\b(SELECT|INSERT|UPDATE|DELETE)\b.*(\$\{|"\s*\+|'\s*\+|%s|\bf["']|Sprintf)/i,
    title: "SQL built from strings",
    why: "String-built SQL is a classic injection risk. Prefer parameters.",
  },
  {
    rule: "hardcoded-secret",
    severity: "high",
    pattern:
      /\b(password|passwd|secret|api[_-]?key|private[_-]?key|access[_-]?token)\b\s*[:=]\s*["'`][^"'`]{6,}/i,
    title: "Possible hard-coded secret",
    why: "Secrets in code end up in git history forever.",
  },
  {
    rule: "raw-html",
    severity: "high",
    pattern: /dangerouslySetInnerHTML|\.innerHTML\s*=|v-html|\|\s*safe\b/,
    title: "Raw HTML injection point",
    why: "Unescaped HTML can lead to XSS if any part is user-controlled.",
  },
  {
    rule: "auth-crypto",
    severity: "medium",
    pattern:
      /\b(auth\w*|permission\w*|isAdmin|jwt|csrf|cors|crypto|bcrypt|encrypt|decrypt|signature|oauth)\b/i,
    title: "Touches auth, permissions or crypto",
    why: "Mistakes here are security bugs. Read slowly.",
  },
  {
    rule: "concurrency",
    severity: "medium",
    pattern:
      /\bgo\s+(func\b|\w+\()|\bsync\.(Mutex|RWMutex|WaitGroup|Once)|Promise\.(all|race|any|allSettled)|\bset(Timeout|Interval)\b|\bthreading\b|asyncio\.(gather|create_task)|\batomic\.|\bchan\s+\w|\bselect\s*\{/,
    title: "Concurrency or timing",
    why: "Races and ordering bugs hide here. Think about what runs at the same time.",
  },
  {
    rule: "swallowed-error",
    severity: "medium",
    pattern:
      /catch\s*(\([^)]*\))?\s*\{\s*\}|\.catch\(\s*\(\)\s*=>\s*(\{\s*\}|null|undefined)\s*\)|\b_\s*=\s*err\b|except(\s+[\w.]+)?(\s+as\s+\w+)?:\s*pass\b|\bexcept:\s*$/,
    title: "Error silently ignored",
    why: "If this fails, nobody will know. Is that really fine?",
  },
  {
    rule: "magic-value",
    severity: "low",
    pattern: /\b(sleep|timeout|delay|retry|retries|ttl|backoff|limit|max\w*)\b[^\n]*\b\d{2,}\b/i,
    title: "Hard-coded timing or limit",
    why: "Where does this number come from? Should it be named or configurable?",
  },
];

const LEFTOVER_PATTERNS: Pattern[] = [
  {
    rule: "todo",
    severity: "low",
    pattern: /\b(TODO|FIXME|XXX|HACK)\b/,
    title: "TODO left in",
    why: "Is this follow-up tracked somewhere, or will it be forgotten?",
  },
  {
    rule: "debug-output",
    severity: "low",
    pattern:
      /\bconsole\.(log|debug)\(|\bdebugger\b|\bfmt\.Print(ln|f)?\(|^\s*print\(|\bpdb\.set_trace|\bbreakpoint\(\)|\bdbg!\(/,
    title: "Debug output left in",
    why: "Likely meant to be removed before merging.",
  },
  {
    rule: "suppression",
    severity: "low",
    pattern:
      /eslint-disable|@ts-ignore|@ts-expect-error|\bnolint\b|#\s*noqa|type:\s*ignore|#\[allow\(/,
    title: "Lint or type check suppressed",
    why: "Why is the checker wrong here? Could the code be changed instead?",
  },
  {
    rule: "commented-code",
    severity: "low",
    pattern: /^\s*(\/\/|#)\s*[\w.$]+\(.*\);?\s*$|^\s*(\/\/|#)\s*(const|let|var|return|if|for)\b/,
    title: "Commented-out code",
    why: "Dead code in comments goes stale. Delete it, git remembers.",
  },
];

function addedLines(file: FileDiff): DiffLine[] {
  return file.hunks.flatMap((hunk) => hunk.lines.filter((line) => line.kind === "add"));
}

function removedLines(file: FileDiff): DiffLine[] {
  return file.hunks.flatMap((hunk) => hunk.lines.filter((line) => line.kind === "del"));
}

function hotspot(
  rule: string,
  severity: Severity,
  file: FileDiff,
  line: number | null,
  title: string,
  why: string,
): Hotspot {
  return {
    id: `${rule}:${file.path}:${line ?? 0}`,
    rule,
    severity,
    path: file.path,
    line,
    title,
    why,
  };
}

function matchPattern(file: FileDiff, pattern: Pattern): Hotspot[] {
  const matches = addedLines(file).filter((line) => pattern.pattern.test(line.text));
  if (matches.length === 0) return [];
  const where = matches.length > 1 ? ` (${plural(matches.length, "place")})` : "";
  return [
    hotspot(
      pattern.rule,
      pattern.severity,
      file,
      matches[0].newLine,
      `${pattern.title}${where}`,
      pattern.why,
    ),
  ];
}

function isTestOrGenerated(file: FileDiff): boolean {
  const role = classifyFile(file.path);
  return role === "test" || role === "generated";
}

const codePatterns: Rule = (file) =>
  isTestOrGenerated(file) ? [] : CODE_PATTERNS.flatMap((pattern) => matchPattern(file, pattern));

const leftovers: Rule = (file) =>
  classifyFile(file.path) === "generated"
    ? []
    : LEFTOVER_PATTERNS.flatMap((pattern) => matchPattern(file, pattern));

function definitionNames(lines: DiffLine[]): Map<string, DiffLine> {
  const names = new Map<string, DiffLine>();
  for (const line of lines) {
    const name = line.text.match(DEFINITION)?.[1];
    if (name && !names.has(name)) names.set(name, line);
  }
  return names;
}

function changedSignaturesIn(file: FileDiff): Map<string, DiffLine> {
  const removed = definitionNames(removedLines(file));
  const added = definitionNames(addedLines(file));
  const changed = new Map<string, DiffLine>();
  for (const [name, line] of added) {
    if (removed.has(name) && removed.get(name)!.text.trim() !== line.text.trim())
      changed.set(name, line);
  }
  return changed;
}

export function changedSignatureNames(diffs: FileDiff[]): string[] {
  return [...new Set(diffs.flatMap((file) => [...changedSignaturesIn(file).keys()]))];
}

const signatureChange: Rule = (file, context) =>
  [...changedSignaturesIn(file)].map(([name, line]) => {
    const callers = context.callerCounts.get(name) ?? 0;
    const severity = callers > BUSY_CALLER_LIMIT ? "high" : "medium";
    return hotspot(
      "signature-change",
      severity,
      file,
      line.newLine,
      `Signature of ${name} changed`,
      `${plural(callers, "other place")} in the repo mention ${name}. Do they all still work?`,
    );
  });

function branchLines(file: FileDiff): DiffLine[] {
  return addedLines(file).filter((line) => BRANCH.test(line.text));
}

const largeChange: Rule = (file) => {
  if (classifyFile(file.path) === "generated") return [];
  const found: Hotspot[] = [];
  const bigHunk = file.hunks.find(
    (hunk) => hunk.lines.filter((line) => line.kind === "add").length > HUNK_SIZE_LIMIT,
  );
  if (bigHunk) {
    found.push(
      hotspot(
        "big-hunk",
        "medium",
        file,
        bigHunk.newStart,
        "Big block of new code",
        "Take this one slowly, maybe in two sittings.",
      ),
    );
  }
  const branches = branchLines(file);
  if (branches.length >= BRANCH_LIMIT) {
    found.push(
      hotspot(
        "branching",
        "medium",
        file,
        branches[0].newLine,
        `${plural(branches.length, "new branch")} of logic`,
        "Lots of paths through the code. Are all of them tested?",
      ),
    );
  }
  return found;
};

const migration: Rule = (file) =>
  MIGRATIONS.test(file.path)
    ? [
        hotspot(
          "migration",
          "high",
          file,
          null,
          "Database or schema change",
          "Is it reversible? Safe on a big table? Deployed in the right order?",
        ),
      ]
    : [];

function hasManifestChange(diffs: FileDiff[]): boolean {
  return diffs.some((diff) => MANIFESTS.test(diff.path));
}

const dependencies: Rule = (file, context) => {
  if (MANIFESTS.test(file.path)) {
    return [
      hotspot(
        "dependencies",
        "low",
        file,
        null,
        "Dependency manifest changed",
        "New or bumped packages: check versions, licences and size.",
      ),
    ];
  }
  if (LOCKFILES.test(file.path) && !hasManifestChange(context.diffs)) {
    return [
      hotspot(
        "lockfile-drift",
        "low",
        file,
        null,
        "Lockfile changed on its own",
        "No manifest change explains this. Accidental?",
      ),
    ];
  }
  return [];
};

function topChurn(churn: Map<string, number>): number {
  const counts = [...churn.values()].sort((a, b) => b - a);
  return counts[Math.floor(counts.length * CHURN_TOP_SHARE)] ?? 0;
}

const churn: Rule = (file, context) => {
  const count = context.churn.get(file.path) ?? 0;
  if (!CHURN_ROLES.has(classifyFile(file.path))) return [];
  if (count < Math.max(CHURN_LIMIT, topChurn(context.churn))) return [];
  return [
    hotspot(
      "churn",
      "low",
      file,
      null,
      `Often-changed file (${count} recent commits)`,
      "Bugs like to live in files that change a lot.",
    ),
  ];
};

function testCaseCount(lines: DiffLine[]): number {
  return lines.filter((line) => TEST_CASE.test(line.text)).length;
}

const removedTests: Rule = (file) => {
  if (classifyFile(file.path) !== "test") return [];
  const removed = testCaseCount(removedLines(file));
  if (file.status === "deleted" || removed > testCaseCount(addedLines(file))) {
    return [
      hotspot(
        "tests-removed",
        "high",
        file,
        null,
        "Tests removed",
        "Was the behaviour removed too, or did the tests just stop passing?",
      ),
    ];
  }
  return [];
};

export const FILE_RULES: Rule[] = [
  signatureChange,
  migration,
  removedTests,
  codePatterns,
  largeChange,
  dependencies,
  churn,
  leftovers,
];

const MIN_UNTESTED_LINES = 10;

function isCode(file: FileDiff): boolean {
  const role = classifyFile(file.path);
  return role === "core" || role === "caller" || role === "types";
}

export function missingTests(diffs: FileDiff[]): Hotspot[] {
  if (diffs.some((diff) => classifyFile(diff.path) === "test")) return [];
  const code = diffs.filter((diff) => isCode(diff) && diff.additions >= MIN_UNTESTED_LINES);
  if (code.length === 0) return [];
  const largest = [...code].sort((a, b) => b.additions - a.additions)[0];
  return [
    hotspot(
      "no-tests",
      "medium",
      largest,
      null,
      "No tests changed in this PR",
      `${plural(code.length, "code file")} changed without any test changes.`,
    ),
  ];
}
