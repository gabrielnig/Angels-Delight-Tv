# TDD Protocol

Status: binding from the first line of code. Applies to every developer and every AI session. Related: `CLAUDE.md`, `docs/TESTING.md`, `docs/AI-CODE-FOOTPRINT.md`, `docs/SECURITY.md`.

## 1. The rule

No production code is written without a failing test that demands it. Every change follows red, green, refactor:

1. Red. Write one test for one behavior. Run only that test file. Watch it fail. The failure must be the right one: an assertion about the missing behavior, not an import error, typo or setup problem. If it passes immediately, the test is wrong or the behavior already exists. Fix that first.
2. Green. Write the smallest code that makes the test pass. Run the same scoped test. Nothing else is added.
3. Refactor. With the test green, improve names and structure. Re-run the scoped test after each step. Do not add behavior during refactor.

Bug fixes start with a test that reproduces the bug and fails. Security fixes include a regression test that fails before the fix.

Exceptions need a note in the PR: pure configuration files, generated code, Dockerfiles, static copy. Anything with branching logic is covered by the rule.

## 2. Scoped runs only, never the full suite

Local and AI sessions run only the tests for the item being worked on.

```bash
pnpm vitest run apps/web/src/server/auth/session.test.ts      # one file
pnpm vitest run apps/web/src/server/auth                       # one folder
pnpm vitest run apps/web/src/server/auth/session.test.ts -t "rejects an expired session"
pnpm vitest related --run apps/web/src/server/auth/session.ts  # tests that import a changed file
pnpm exec playwright test apps/web/e2e/auth.e2e.ts             # one e2e spec
```

Never run `pnpm vitest run` or `pnpm test` with no path. Package scripts named `test` are not to be run in a session. The pre-commit hook runs `vitest related --run` on staged files only.

CI runs affected tests on each PR (`vitest run --changed origin/main`). No nightly full-suite job is enabled for now (see D-012 in `docs/DECISIONS.md`).

## 3. Test naming and layout

- Files sit next to the code: `session.ts` and `session.test.ts`. Integration tests: `*.int.test.ts`. End to end: `apps/web/e2e/*.e2e.ts`.
- `describe` names the unit (`describe('createSession', ...)`). `it` states a behavior in plain present tense, specific to the case:
  - Good: `it('returns 404 when the profile belongs to another account')`, `it('stops transcoding at the source height')`.
  - Bad: `it('works')`, `it('should handle errors')`, `it('test 3')`.
- One behavior per test. Arrange, act, assert, in that order, no logic in tests.
- Test data uses domain names (`kidsProfile`, `unpublishedVideo`), not `data`, `item`, `temp`.

## 4. What to mock

| Mock | Do not mock |
|---|---|
| Time (fake timers or an injected clock) | The database. Integration tests use a real Postgres from compose |
| Randomness only when the value itself is asserted | Your own modules and functions |
| Network at the edge: SMTP, whisper HTTP, Turnstile, HIBP | Zod, argon2, HMAC and other pure libraries |
| Object storage: use the `local` storage driver or an in-memory fake that implements `StorageAdapter` | The queue (use a real pg-boss on the test database when the flow matters) |
| FFmpeg: unit test the argument builders as pure functions | FFmpeg in the single slow test per encoder feature, which uses a 2 second clip generated at test time with `ffmpeg -f lavfi` (no binary fixtures in git) |

Over-mocking proves nothing. If a test needs more than two mocks, it is probably at the wrong level.

## 5. Commit rhythm

- Commit at each real checkpoint: a behavior reaches green, a refactor settles, a doc section is complete. Test and implementation for a behavior go in the same commit.
- Before ending a session, or when a rate limit nears, commit green work and update `ai-context.md` so no progress is lost.
- Never commit with a failing scoped test. Never use `--no-verify`.
- Messages are one line stating the change and why: `Reject kids profiles on non kids-safe video queries to close a direct URL bypass`.
- Keep real history. Do not squash unrelated work into one large commit, and do not split arbitrarily by line count.

## 6. Git rules

- Identity: `git config user.name ARKDEV` and the project email in the repo-local config. Check with `git log -1 --format='%an %ae'`.
- No AI attribution anywhere: no co-author trailers, no tool-generated footers, no session links, in commits, PR descriptions or files.
- No emojis. No em dashes or en dashes in code, comments, docs, commits, PR text or UI copy. Use a period, comma, colon or parentheses.
- Branches: `feat/short-name`, `fix/short-name`, `docs/short-name`, `chore/short-name`.
- PR flow: branch from `main`, commit, push, open a PR with a short description (what, why, tests run, security impact), wait for CI, review the diff, merge with rebase-merge (linear history, no merge commits), delete the branch. `main` is protected. Never push straight to `main` after the first commit.
- Never force-push a shared branch. Rebase your own branch on `main` before opening the PR.

## 7. Definition of done

A change is done only when all are true:

- [ ] A failing test existed first and the scoped tests for the item now pass.
- [ ] Authorization and validation are tested for any new route (anonymous, wrong role, other account's resource).
- [ ] Type check and lint pass for the touched packages (`pnpm --filter @ad/web typecheck`, `pnpm --filter @ad/web lint`).
- [ ] UI changes were reviewed with the `angels-delight-design-system` skill and follow `docs/DESIGN-SYSTEM.md` and the UI-UX standard.
- [ ] Docs updated in the same change: `docs/DATA-MODEL.md` for schema, `docs/ARCHITECTURE.md` for flows, `CHANGELOG.md` under Unreleased, `docs/API.md` if present.
- [ ] Anything client-facing stays configurable, nothing hardcoded.
- [ ] Decisions that needed the owner are logged in `docs/DECISIONS.md`.
- [ ] The AI footprint pass below is clean.
- [ ] `ai-context.md` updated if the session was significant.

### 7.1 AI footprint grep

A passing suite does not replace this pass. Run it on the staged diff and on the commit messages. Escapes are used so this file itself contains none of the banned characters.

```bash
# dashes (em, en), smart quotes, and common emoji ranges in the staged diff
git diff --cached -U0 | LC_ALL=C.UTF-8 grep -nP '[\x{2013}\x{2014}\x{2018}\x{2019}\x{201C}\x{201D}\x{2600}-\x{27BF}\x{1F300}-\x{1FAFF}]'

# the same over commits not yet on main
git log origin/main..HEAD --format='%B' | LC_ALL=C.UTF-8 grep -nP '[\x{2013}\x{2014}\x{2018}\x{2019}\x{201C}\x{201D}\x{2600}-\x{27BF}\x{1F300}-\x{1FAFF}]'

# AI attribution in the diff and in commit messages
git diff --cached -U0 | grep -niE 'co-authored-by|generated with|claude\.ai/code|noreply@anthropic'
git log origin/main..HEAD --format='%B' | grep -niE 'co-authored-by|generated with|claude\.ai/code|noreply@anthropic'

# author identity
git log origin/main..HEAD --format='%an' | sort -u    # must print only ARKDEV
```

Every command must print nothing (the author check must print only `ARKDEV`). The repo ships these in `scripts/footprint-check.sh`, run by the pre-commit hook and CI.

Manual checks from `docs/AI-CODE-FOOTPRINT.md`, each as a deliberate step:
- Comments explain why, not what. Delete restating comments.
- No unused class, function, parameter or option. Remove speculative structure.
- No generic names (`handleData`, `processItem`, `result`, `temp`). Name the domain concept.
- No bare `catch` that returns a success-shaped value. Authorization, upload and key code is read specifically for swallowed errors. An error is handled with an intentional, logged fallback or it propagates.
- No mechanical null checks where types or constraints already guarantee the value. Validate at trust boundaries only.
- Commit history shows real checkpoints and messages are specific.
