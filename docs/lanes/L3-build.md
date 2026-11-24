# Lane L3 build notes (admin polish, bulk actions, captions control, M42)

Plan: `docs/plan/v2/L3-admin-polish.md` (section 14 wins), review `docs/reviews/v2/L3-review.md`, rulings `docs/plan/v2/RULINGS.md`. Decisions D-170 to D-186 (plan ids L3-D01 to L3-D17; D-186 is the ink tokens).

## Slices
- L3-01 layout fixes: done (padded card lists, `adm-num` / `adm-ctr` / `adm-actions` alignment, `adm-table--always` and `--sticky`, no inline `display: table`). Tests: `pnpm vitest run apps/web/src/components/admin/admin-css.test.ts apps/web/src/components/admin/tables.test.ts apps/web/src/components/admin/EncodingQueue.test.tsx`.
