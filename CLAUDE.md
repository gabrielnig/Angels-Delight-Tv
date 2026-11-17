# Angels Delight TV: working rules

Read `ai-context.md` first, then `docs/BUILD-PLAN.md`. Product: a free, self-hosted, Netflix-style educational video platform (Nigeria first, diaspora later). Client: Sister Vanessa. Developer: ARKDEV.

## Git rules (binding)
- Every commit is authored and committed as `ARKDEV` (`git config user.name ARKDEV`). Never as Claude.
- No AI attribution anywhere: no Co-Authored-By lines, no "Generated with" lines, no session links, in commits, PRs or files.
- No emojis. No em dashes or en dashes in code, comments, docs, commits or UI copy. Grep every diff for them before committing.
- Messages state the specific change and why, in one line.
- Work on a feature branch, open a PR, merge it. Never push straight to `main` after the first commit.

## Test rules (binding)
- Test-driven: write the failing test first, see it fail, then build until it passes.
- Run only the tests for the item being worked on (`pnpm vitest run path/to/file`). Never run the full suite.

## Decisions
- When a decision needs the owner, take the recommended option and log it in `docs/DECISIONS.md` (decision, options, why, reversible or not). Do not stop to ask.
- Anything needing client input (colours, name, domain, content) stays configurable. Do not hardcode it.

## Quality
- Follow `docs/AI-CODE-FOOTPRINT.md`, `docs/SECURITY.md` and `docs/DESIGN-SYSTEM.md`.
- Use the `angels-delight-design-system` skill as the reviewer for every UI change.
- Update `ai-context.md` at the end of every significant session.
