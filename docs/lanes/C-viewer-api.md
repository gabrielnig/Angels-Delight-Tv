# Lane C: viewer API and domain services

Packages: `@ad/catalog` (queries and publishing, no actor), `@ad/viewer` (profile scoped services), routes in `apps/web/src/app/api`, wiring in `apps/web/src/server/viewer`.

## Rules every consumer can rely on
- Every service is `(ctx: ViewerContext, actor: Actor, input)`. Reads and writes run in `withAccount` and filter by `account_id`. A profile id that is not the actor's answers NotFound (404), the same as an unknown id.
- Kids filtering is server side: a kids profile only ever sees `kids_safe` titles, in lists, search, detail, progress and My List.
- Lists use keyset cursors (opaque strings, pass back as `cursor`). Search and home row paging use an offset cursor.
- Errors are `AppError` subclasses: Unauthorized 401, Forbidden 403 (`kids_gate`, `pin_required`, `pin_invalid`, `password_incorrect`), NotFound 404, Conflict 409, ValidationFailed 422 with `fields`, RateLimited 429 with `retryAfterSeconds`.

## Service interfaces (import from `@ad/viewer`)
```ts
interface ViewerContext {
  db: Database; mediaOrigin: string; nameCipher: NameCipher;
  verifyPassword(accountId: string, password: string): Promise<boolean>;
  rateLimit?: (bucket: 'progress' | 'search' | 'profile_pin' | 'kids_exit', subject: string)
    => Promise<{ allowed: boolean; retryAfterSeconds: number }>;
  now?: () => Date; rules?: Partial<ViewerRules>;
}
listProfiles(ctx, actor): Promise<ProfileDto[]>
createProfile(ctx, actor, input: CreateProfileInput, options?: { activeProfileId? }): Promise<ProfileDto>
updateProfile(ctx, actor, profileId, input: UpdateProfileInput, options?: ManageOptions): Promise<ProfileDto>
deleteProfile(ctx, actor, profileId, options?): Promise<void>
selectProfile(ctx, actor, profileId, options?: { pin?: string }): Promise<ProfileDto>
exitKidsMode(ctx, actor, input: { password: string }): Promise<{ ok: true }>
getHome(ctx, actor, input: { profileId; cursor? }): Promise<HomeDto>
browse(ctx, actor, input: BrowseInput): Promise<BrowsePage>
listBrowseCategories(ctx, actor, input: { profileId }): Promise<CategoryDto[]>
search(ctx, actor, input: SearchInput): Promise<SearchResultDto>
suggest(ctx, actor, input: { profileId; query }): Promise<Suggestion[]>
getRecentSearches / removeRecentSearch / clearRecentSearches
getTitleDetail(ctx, actor, input: { profileId; id? ; slug?; kind? }): Promise<TitleDetailDto>
saveProgress(ctx, actor, input: SaveProgressInput): Promise<ProgressDto | null>
getProgress / removeProgress / continueWatching(ctx, actor, { profileId })
addToMyList(ctx, actor, { profileId; target: { kind; id }; restoreAddedAt? }): Promise<MyListChange>
removeFromMyList(ctx, actor, { profileId; target }): Promise<MyListChange>
listMyList(ctx, actor, { profileId; limit?; cursor? }): Promise<Page<MyListItem>>
```
Exact DTO and input types live in the files named after each service in `packages/viewer/src`. Request schemas for forms are in `@ad/viewer/schemas`.

## Staff services (import from `@ad/catalog`)
```ts
publish(ctx: PublishingContext, actor, 'video' | 'series', id, input?: { publishAt?: Date; captionOverride?: { reason: string } }): Promise<PublishResult>
unpublish(ctx, actor, target, id): Promise<PublishResult>
cancelSchedule(ctx, actor, target, id): Promise<PublishResult>
evaluateChecklist(tx, target, id, { requireApprovedCaptions }): Promise<PublishChecklist>
promoteDueScheduled(ctx): Promise<{ published; blocked }>   // scheduler tick, run every minute
seedDemo(db, now?) / clearDemo(db)
```
Editors and admins only. A failed checklist is a 422 with `fields.checklist` listing what is missing.

## Routes (all JSON, `private, no-store`, signed in viewers only)
| Route | Methods | Notes |
| --- | --- | --- |
| `/api/profiles` | GET, POST | list, create |
| `/api/profiles/[id]` | PATCH, DELETE | update (send `expectedUpdatedAt`), delete |
| `/api/profiles/[id]/select` | POST | body `{ pin? }`, sets the active profile cookie |
| `/api/profiles/exit-kids` | POST | body `{ password }`, clears the cookie |
| `/api/home` | GET | `?profileId&cursor` |
| `/api/browse`, `/api/browse/categories` | GET | `?profileId&category&sort&duration&limit&cursor` |
| `/api/search`, `/api/search/suggest` | GET | `?profileId&q&record&cursor` |
| `/api/search/recent` | GET, DELETE | DELETE with `q` removes one, without clears all |
| `/api/titles/[id]` | GET | id or slug, `?profileId&kind` |
| `/api/progress` | GET, POST, DELETE | POST accepts `sendBeacon` text bodies |
| `/api/my-list` | GET, POST, DELETE | body `{ profileId, target }` |

## Tests
```
export TEST_DATABASE_ADMIN_URL=postgres://postgres:postgres@localhost:5432/postgres
pnpm vitest run packages/catalog packages/viewer     # services, security suite (IDOR, RLS, kids matrix)
pnpm vitest run apps/web/src/server/viewer           # routes
```
Seed development data with `pnpm db:seed:demo` (30 titles, 3 series, 5 categories, 6 home rows). It skips when demo data exists.

## Known gaps
- Server caching and ETag for catalog reads (M04-S05) are not done.
- Slug generation with redirects on rename and artwork record editing (M36) are not exposed as services yet. Redirects are read already.
- Kids admin link, Open Graph and the public preview are not done.
- With no active profile cookie, management routes treat the browser as being on the picker. A kids user who clears the cookie reaches the picker, which needs the PIN only for PIN protected profiles. Tighten with a password prompt if the client wants it.
- "Remove from row" deletes the progress record and with it the watched tick.
- A playback authorization helper for the player lane is not written yet.
