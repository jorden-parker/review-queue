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

**Re-review after a push** (`review_baselines` table,
`lib/review/interdiff.ts`). When `markSeen` sees a new head, it stores the
previous head as the session's baseline (once, so a second push does not move
it) and clears `finished_at` so the PR shows as in progress again. The
`catch-up` session action clears the baseline. `changes?sha=` returns the
interdiff from the baseline (404 when there is none), `head` returns the current
head, and `submit` answers 409 when the PR head no longer matches the `headSha`
being posted.

**PR conversation and receipts** (`lib/github/conversation.ts`, `gh.ts`,
`components/review/conversation-*`). The `conversation` route reads the first
100 review comments and reviews through `conditionalGet` (ETag cache in the
store, TTL cache in `services.ts`), and the "On GitHub" pane shows them with
threads per line. `submitReview` returns the created review's id and URL, and
the `submissions` table keeps a receipt of each post. "Start over" never clears
receipts. Comment and review bodies are author-written: they render through
`Markdown` only, and they must stay out of `ReviewData` and every model prompt
(`src/lib/llm/**`, `assist-service.ts`).

**API routes** (`src/app/api/pr/[owner]/[repo]/[number]/*`). The base route
loads the review. `definitions`, `references` and `orientation` take `?sha=` and
use `preparedFromRequest` (`lib/review/route-context.ts`), which returns 409 if
that SHA is no longer in memory. `outline` and `reference-counts` take
`?sha=&path=` (`fileLookupRoute` in `lib/review/symbol-query.ts`). They return a
file's symbol tree and the per-declaration reference counts shown above changed
declarations (`lib/review/reference-counts.ts`, which uses the LSP and falls
back to the index). `session` applies zod-validated `SessionAction`s
(`lib/review/session-actions.ts`). `submit` posts the review through `gh`.
`assist` (POST `?sha=`, `lib/review/assist-service.ts`) streams plain text from
the model about a range of diff lines. The client sends hunk and line indexes,
never code. The server reads the lines from its own diff, and it ends a failed
stream with the `ASSIST_ERROR_MARKER` from `lib/assist-protocol.ts`.

**Singletons** (`lib/review/services.ts`). The SQLite `SessionStore`
(`lib/session/store.ts`) is stored on `globalThis` so it survives HMR. It
defaults to `~/.local/share/review-queue/review-queue.db`, and `REVIEW_QUEUE_DB`
overrides that. The store holds sessions, done steps, checked hotspots, notes,
jumps, context symbols and a key/value cache.

**Symbol navigation** (`lib/review/navigation.ts`, `lib/lsp/`). Every identifier
in a navigable file is a link (shiki keyword scopes are excluded in
`lib/highlight.ts`). The `definitions` and `references` routes take the
identifier's exact `path`, `line`, `character` and diff `side`, and ask a real
language server through `lib/lsp/client.ts`. Servers are pooled per worktree and
language on `globalThis`, shut down after 10 idle minutes, and warmed when a
review loads. TypeScript/JavaScript use the bundled `typescript-language-server`
with its own `tsserver`. `gopls` and `pyright-langserver` are used when they are
on `PATH`. `rust-analyzer` also needs `REVIEW_QUEUE_LSP_RUST=on`, because a
repo's own `rust-analyzer.toml` or `.cargo/config.toml` can turn build scripts
back on. Deleted lines, missing servers, timeouts and empty answers fall back to
the tree-sitter `SymbolIndex`. Library locations are never read from disk; they
come back as `scope: "external"` with hover text. Configure it with
`REVIEW_QUEUE_LSP=off` and `REVIEW_QUEUE_LSP_TIMEOUT_MS` (default 8000). PR code
is untrusted, so `lib/lsp/servers.ts` turns off everything that could run it:
build scripts, proc macros, toolchain and module downloads, cgo, repo `rustc`
wrappers, tsserver plugins and type acquisition. Keep it that way when you add a
server.

**Context tab** (`components/review/context-list.tsx`, `context-symbols.ts`).
Each peek that resolves is recorded as a seen symbol (`symbol-seen`), and the
reader can pin symbols (`symbol-pin`, `m`). These are stored in the
`context_symbols` table along with where they were clicked from, so reopening a
row re-runs the peek. The tab has view and kind toggles plus the jump-trail
buttons. `g c` opens it.

**LLM orientation** (`lib/llm/orientation.ts`,
`lib/review/orientation-service.ts`). This is optional and calls an
Ollama-compatible endpoint. Results are cached in the store's cache table.
Configure it with `REVIEW_QUEUE_LLM_URL` (or `OLLAMA_HOST`),
`REVIEW_QUEUE_LLM_MODEL`, `REVIEW_QUEUE_LLM_TIMEOUT_MS`, and
`REVIEW_QUEUE_LLM=off`. Models think before answering, with 2048 extra tokens
for it; `REVIEW_QUEUE_LLM_THINKING=off` stops that, but only use it with a model
that does not then write its reasoning into the answer. Without
`REVIEW_QUEUE_LLM_MODEL`, `lib/llm/model-choice.ts` uses the first model in
claude-ollama's `ollama/sizes.json` (found by following the `claude-ollama`
launcher on `PATH`) that Ollama has installed.

**Settings page** (`app/settings/page.tsx`, `lib/settings/`). It edits the model
on/off, model, thinking and timeout, saved in the store's `settings` table. Once
saved, these replace the matching environment variables; the URL stays
environment-only so PR code cannot be sent elsewhere from the UI. LLM routes get
their config from `currentLlmConfig()` in `lib/review/services.ts`.
`PUT /api/settings` saves and `DELETE /api/settings/cache` empties the cache
table (orientations, step explanations and GitHub ETags).

**Security boundary** (`src/proxy.ts`, the Next 16 replacement for middleware).
It rejects any non-loopback `Host`, then requires the `review-queue-token`
cookie on every request. The token lives in a 0600 file
(`~/.local/share/review-queue/access-token`; `REVIEW_QUEUE_TOKEN_FILE` overrides
it), and `src/instrumentation.ts` prints a `http://127.0.0.1:4477/?token=…` link
at startup. Opening that link sets the cookie (HttpOnly, SameSite=Strict).
Non-GET requests must also be same-origin and `application/json`, and every
response forbids framing. New mutating routes depend on this, so keep request
bodies JSON.

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

**UI** (`src/components/ui/`) holds shadcn/ui primitives (Radix base); add more
with `bunx shadcn@latest add <name>` and delete exports nothing uses so Fallow
stays clean. Shared app pieces (`HintButton`, `PathLabel`, `AppDialog`,
`EmptyState`, `Celebration`) live in `src/components/common/`. All colours,
sizes and motion are tokens in `src/app/globals.css`, with dark mode following
`prefers-color-scheme`; use those utilities instead of hex or arbitrary values.

Shared domain types are in `src/lib/types.ts`. Use the `@/` import alias for
`src/`.
