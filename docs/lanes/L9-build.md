# Lane L9 build: monetization (M48)

Plan: `docs/plan/v2/L9-monetization.md` (section 16 wins), rulings `docs/plan/v2/RULINGS.md` (R25), review `docs/reviews/v2/L9-review.md`. Everything ships off. Decisions D-247 to D-267 (L9-D01 to L9-D21).
Scoped tests only: `pnpm vitest run <file>`. DB tests need `pg_ctlcluster 16 main start` and `TEST_DATABASE_ADMIN_URL` (DEV-SETUP.md section 5).

## Merged
- Slice 0 docs, settings and env: PRD sections 4 and 12, SECURITY section 12 and the last DESIGN-SYSTEM rule amended, M48 in MODULES and USER-STORIES (44 stories), sponsor tokens documented in DESIGN-SYSTEM section 3.1 (added to tokens.css in slice 5), decisions D-247 to D-267. The 38 settings live in `packages/theme/src/settings-monetization.ts` (spread into the registry; the plan said `@ad/config`, but the registry lives in `@ad/theme`). Cross key rules (`crossCheckMonetization`, run by `SettingsService.update`): presets inside min and max, donations need `PAYSTACK_SECRET_KEY`, monthly and USD need donations, USD currency needs the USD switch. Env: `PAYSTACK_SECRET_KEY` (sk_test_ anywhere, sk_live_ only in production), `PAYSTACK_BASE_URL`, `DONATE_RECEIPT_TOKEN_SECRET`. Flutterwave variables are not added (Could, not built).
  Tests: `packages/theme/src/settings-monetization.test.ts`, `settings-monetization-service.test.ts`, `packages/config/src/env.test.ts`, `env-example.test.ts`, `scripts/monetization-doc-sync.test.ts`.

## Remaining
Slices 1 to 14 of the plan, in order.
