# Lane L1 build notes (module M40, guest access)

Plan: `docs/plan/v2/L1-guest-access.md`. Rulings: `docs/plan/v2/RULINGS.md` (they win). Review: `docs/reviews/v2/L1-review.md`. Worktree: `/home/claude/wt2/L1-build`. Branch per slice `l1/sN-...`.

## Slices

| # | Slice | State | PR |
|---|---|---|---|
| 1 | Guest identity and guest playback token | merged on PR | see below |
| 2 | Watch page, local progress, analytics identity | todo | |
| 3 | Account free catalog path and public GETs | todo | |
| 4 | Guest chrome, title and series, Sign in to save | todo | |
| 5 | Home, Browse, Search for guests | todo | |
| 6 | Guest audience, Kids mode, settings | todo | |
| 7 | My List explainer, return intent | todo | |
| 8 | Guest Continue learning | todo | |
| 9 | History import | todo | |
| 10 | Abuse protection, Turnstile escalation | todo | |
| 11 | Robots, journeys, documents | todo | |

## Slice 1 (guest identity and playback)

Exists:
- `apps/web/src/server/guest/guest-cookie.ts`: `guestCookieName(secure)`, `guestCookieOptions(secure)`, `newGuestId()`, `signGuest`, `readGuest(secret, value)` (id or null), `guestSetCookie(secret, secure, id)` (the header value).
- `apps/web/src/server/guest/resolve-guest.ts`: `resolveGuest(request, { secret, secure, mint })` returns `{ guestId, isNew }` or null. The secret is `activeProfileKey(PLAYBACK_TOKEN_SECRET)`.
- `@ad/video` `playback-token.ts`: claims `gst` and `kd`, `IssueInput.guest` and `.kids`.
- `@ad/video` `PlaybackService.startGuestSession({ guestId, kids, ip? }, videoId)`, `GUEST_SEGMENT_URL_SECONDS`, policies `sessionGuest` (20 per minute) and `sessionGuestIp` (120 per minute), dep `guestSegmentTtlSeconds` (number or async function).
- `createPlaybackHandlers` deps `getGuest(request, { mint })` and `guestPlayEnabled()`. An account session always wins. Guest play off or no guest deps gives 401. Same origin check runs before the cookie is read.
- `VideoRuntime.guest` in `apps/web/src/server/video/api.ts`, wired in `runtime.ts` from settings `features.guest_play` and `limits.guest_segment_minutes`.
- Settings keys `features.guest_play` and `limits.guest_segment_minutes` in `packages/theme/src/settings-registry.ts`.

Plan corrections: none needed for slice 1. The Kids mode flag `kids` is false until slice 6 wires the audience.

Scoped tests:
`pnpm vitest run apps/web/src/server/guest/guest-cookie.test.ts packages/video/src/playback-token.test.ts packages/video/src/playback/service.test.ts packages/video/src/playback/http.test.ts packages/theme/src/settings-registry.test.ts apps/edge/src/handler.test.ts`
and (DB) `apps/web/src/server/video/api.int.test.ts`.
