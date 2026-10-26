# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with
code in this repository.

## What this is

review-queue is a local-only Next.js app for reviewing GitHub pull requests in
an ADHD-friendly way. It turns a PR into a guided reading path of steps, flags
hotspots, tracks progress and notes across pauses, and submits the review
through the `gh` CLI. It needs `gh` to be installed and logged in, and Node >=
22.5 because it uses `node:sqlite`.

## Commands

- `bun run dev`: dev server on http://127.0.0.1:4477 (it binds to loopback only,
  on purpose)
- `bun run test`: all Vitest tests, with coverage
- `bunx vitest run src/lib/plan/reading-path.test.ts`: one file; add
  `-t "<name>"` for a single test
- `bunx vitest run --project node` or `--project dom`: one test environment only
- `bun run typecheck`, `bun run lint`, `bunx fallow`
- `.claude/verify`: runs the full gate (tests, tsc, eslint, fallow). It must
  pass before you finish.

Vitest has two projects. `*.test.ts` runs in node and `*.test.tsx` runs in jsdom
(setup: `src/test/dom-setup.ts`). Shared test helpers live in `src/test/`:
`git-fixture.ts` builds real temporary git repos, `diff-builders.ts`,
`review-fixture.ts`, and `fake-api.ts` for client components.

## Architecture

**Server pipeline** (`src/lib/review/prepare.ts`). `loadReview` fetches PR
metadata through `gh` (`lib/github/gh.ts`). It then makes a bare clone plus a
worktree per head SHA under `~/.cache/review-queue` (`lib/git/checkout.ts`),
parses the diff (`lib/git/diff-parser.ts`), and builds a tree-sitter
`SymbolIndex` over the worktree (`lib/symbols/`). From these it computes
hotspots (`lib/hotspots/`), classifies files and orders them into reading-path
steps (`lib/plan/`), and highlights code with shiki (`lib/highlight.ts`). The
result is a `PreparedReview`, memoized in a `globalThis` map keyed by PR and
head SHA.

**API routes** (`src/app/api/pr/[owner]/[repo]/[number]/*`). The base route
loads the review. `definitions`, `references` and `orientation` take `?sha=` and
use `preparedFromRequest` (`lib/review/route-context.ts`), which returns 409 if
that SHA is no longer in memory. `session` applies zod-validated
`SessionAction`s (`lib/review/session-actions.ts`). `submit` posts the review
through `gh`.

**Singletons** (`lib/review/services.ts`). The SQLite `SessionStore`
(`lib/session/store.ts`) is stored on `globalThis` so it survives HMR. It
defaults to `~/.local/share/review-queue/review-queue.db`, and `REVIEW_QUEUE_DB`
overrides that. The store holds sessions, done steps, checked hotspots, notes,
jumps and a key/value cache.

**LLM orientation** (`lib/llm/orientation.ts`,
`lib/review/orientation-service.ts`). This is optional and calls an
Ollama-compatible endpoint. Results are cached in the store's cache table.
Configure it with `REVIEW_QUEUE_LLM_URL` (or `OLLAMA_HOST`),
`REVIEW_QUEUE_LLM_MODEL`, `REVIEW_QUEUE_LLM_TIMEOUT_MS`, and
`REVIEW_QUEUE_LLM=off`.

**Security boundary** (`src/proxy.ts`, the Next 16 replacement for middleware).
It rejects any non-loopback `Host`. Non-GET requests must be same-origin and
`application/json`. New mutating routes depend on this, so keep request bodies
JSON.

**Shell-outs** all go through `lib/exec.ts` (`Runner`). It drops the repository
variables git exports inside hooks (`lib/git-env.ts`), so checkouts never touch
an enclosing repo. Modules take a `run` parameter so tests can inject fakes, and
`ReviewDeps` injects `fetchPullRequest` and `store` the same way.

**Client** (`src/components/review/`). `review-loader.tsx` →
`review-workspace.tsx`. State lives in `use-*` hooks (navigation, session edits,
peek, jumps, shortcuts, return detection), and `api.ts` is the only place that
fetches. Pure logic is kept in non-hook modules (`hunk-index.ts`, `locate.ts`,
`display-hotspots.ts`, `unfinished.ts`, `shortcut-keys.ts`) and tested in node.
`src/components/inbox/` is the home page's list of review requests.

Shared domain types are in `src/lib/types.ts`. Use the `@/` import alias for
`src/`.
