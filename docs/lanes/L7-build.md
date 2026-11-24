# Lane L7 build notes (module M46, languages)

Plan: `docs/plan/v2/L7-languages.md`. Rulings: `docs/plan/v2/RULINGS.md` (R23: engine off by default, NLLB is non commercial). Worktree `/home/claude/wt2/L7-build`, branch per slice `l7/sNN-...`.
Scoped tests only: `pnpm vitest run <file>`.

## Slices
| Slice | What | PR |
|---|---|---|
| 1 | Locale registry, plurals, numbers, dates, durations | pending |

## Slice 1
- `packages/shared/src/messages/locales.ts`: `LOCALES`, `LOCALE_CODES`, `normalizeLocale`, `parseAcceptLanguage`, `pickLocale`, `localeInfo`.
- `intl.ts` (`pluralCategory`, `formatNumber`, `formatDate`) and `format.ts` (`formatDuration(minutes, t)` reads `format.duration.*` from the catalog). `formatDuration` moved out of `messages.ts`; the barrel still exports it.
- `MessageText` plural objects are now keyed by CLDR category with `other` required. `createMessages('en', ...)` reads the `en-NG` catalog.
- Decision: see `docs/DECISIONS.md` ($D).
