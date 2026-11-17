# Lessons

Running log of real mistakes and corrections, newest first. Add an entry when a mistake is worth not repeating: a bug that escaped, a wrong assumption, a process failure. Keep each entry short and specific. Update the related doc or test in the same change.

Entry format (copy this block, newest entry goes directly under this line):

## YYYY-MM-DD: short title naming the mistake
- What happened: one or two sentences, facts only.
- Root cause: the actual cause, not the symptom.
- Fix: what changed (link the commit or PR).
- Rule going forward: the test, check or doc change that prevents a repeat.

## 2026-11-17: a CHECK with a nullable column passed NULL
- What happened: `CHECK (status <> 'ready' OR duration_ms > 0)`, copied from DATA-MODEL, accepted a ready video with no duration. The integration test for it failed on the first run.
- Root cause: `NULL > 0` is NULL, and a CHECK treats NULL as passing.
- Fix: the constraint now reads `duration_ms IS NOT NULL AND duration_ms > 0` in the schema and in DATA-MODEL.
- Rule going forward: every CHECK that touches a nullable column gets a test with the NULL case.

## 2026-11-17: the pre-commit hook reran the whole suite on a config change
- What happened: the first commit staged `vitest.config.ts`, and `vitest related` ran about twenty test files.
- Root cause: Vitest treats a changed config file as a trigger to rerun every test.
- Fix: the hook installer filters `*config.ts` out of the files it passes to `vitest related`.
- Rule going forward: scoped test commands are checked for config file inputs (D-020).
