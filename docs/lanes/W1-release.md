# Lane W1: release images and no email first deploy

## What exists
- `.github/workflows/release.yml`: workflow_dispatch and `v*` tags only. Matrix of web, worker, whisper, tools. linux/amd64, buildx with the GitHub cache, Trivy scan (CRITICAL with a fix fails, nothing pushed on failure), push to `ghcr.io/gabrielnig/angels-delight-tv-<name>` as full sha, short sha and tag name. Uses `GITHUB_TOKEN` (`packages: write`). Test: `scripts/release-workflow.test.ts`.
- `SMTP_URL=disabled` mode (D-163): `packages/config/src/env.ts` (accepts it), `packages/mailer/src/delivery.ts` (`DisabledTransport`, `isEmailDisabled`, `transportFromSmtpUrl`, `EMAIL_NOT_CONFIGURED`), `packages/queue/src/outbox.ts` (permanent error), `apps/web/src/server/auth/runtime.ts` and `apps/worker/src/runtime.ts` (use `transportFromSmtpUrl`), `apps/web/src/lib/admin/email-status.ts` plus a Banner on the admin dashboard page, `packages/launch/src/dns/check.ts` and `cli/dns-check.ts` (failing `email-configured` check).
- Docs: `docs/LAUNCH-RUNBOOK.md` (Release, Contabo step 4, no email interim mode, smoke blocker), `docs/DEPLOYMENT.md` (sections 2, 6, 7, 13).

## Dockerfile review
- Fixed: `apps/worker/package.json` had `drizzle-orm` as a devDependency but `src/notifier.ts` imports it, so the `pnpm deploy --prod` image died at boot (D-165).
- Checked and fine: build context at repo root (whisper at its own folder), lockfile with `--frozen-lockfile`, `corepack` with `packageManager` pnpm 10.28.0, Node 24 base against `engines >=22.12.0` and `.nvmrc` 24, standalone output at `apps/web/server.js` (built it and booted the copied layout, `/api/health` answered), non-root users (node, uid 10001), healthchecks, migration files and tsx present in the deployed worker and tools layouts, every CLI entry of the tools image resolves its imports.
- A local `docker build` was not possible: the daemon started but Docker Hub answered 429 for the base image. hadolint is not installed. The images were first built by the release workflow run, see the PR notes.

## Scoped tests
```
pnpm vitest run scripts/release-workflow.test.ts packages/mailer/src/delivery.test.ts packages/config/src/env.test.ts packages/launch/src/dns/check.test.ts packages/queue/src/outbox.test.ts apps/web/src/lib/admin/email-status.test.ts
```

## Gaps
- Auth emails (verify, reset) are not stored in the outbox in disabled mode, by design (D-163).
- The Trivy image tag is fixed at 0.69.3 and needs a deliberate bump.
