# Lane E: Viewer UI

Package `@ad/ui` (components, `tokens.css`, `components.css`) and the viewer pages in `apps/web`.

## Routes

- Public: `/` (landing when signed out), `/sign-in`, `/sign-up`, `/verify-email`, `/verify-email/confirm`, `/forgot-password`, `/reset-password`, `/terms`, `/privacy`, `/about`, `/help`, `/maintenance`, `/unsupported`, `/title/[slug]` (public preview when signed out, with Open Graph tags), not-found.
- Signed in: `/` (Home), `/profiles`, `/profiles/manage`, `/profiles/new`, `/profiles/[id]/edit`, `/browse`, `/browse/[categorySlug]`, `/search`, `/title/[slug]`, `/series/[slug]`, `/my-list`.
- Account (adults only, Kids profiles see a password gate): `/account`, `/account/security`, `/account/data`, `/settings/playback`.
- Not mine: `/watch` (lane G), `/offline` and the error page (lane I).

## Exports from `@ad/ui`

Button, ButtonLink, IconButton, Input, Textarea, Select, Checkbox, Switch, PasswordField, OtpInput, ResendCode, Badge, Banner, Pill, PillRow, Skeleton parts, ProgressBar, EmptyState, ErrorState, Modal, ConfirmDialog, ToastProvider and useToast, Tabs, Avatar, ProfileTile, VideoCard, ContinueCard, SeriesCard, Row, Hero, TopNav, BottomTabBar, SiteFooter, Icon, LinkProvider, format helpers.

## Data seam

`apps/web/src/lib/data` defines the interfaces (`CatalogRepository`, `LibraryRepository`, `ProfilesRepository`, `AuthGateway`, `AccountRepository`, `SiteRepository`) with fixtures. Server actions in `app/actions.ts` call them. Swap an accessor in `lib/data/index.ts` to wire a real service.

## Tests

- `pnpm vitest run packages/ui/src/components/<File>.test.tsx`
- `pnpm vitest run apps/web/src/components/<dir>`
- `pnpm exec playwright test apps/web/e2e/home.e2e.ts`

## Gaps

- Auth, profiles, catalogue and account still run on fixtures. Lane B code is on main (`@ad/auth`) but is not yet wired behind `AuthGateway`; the viewer session is a fixture cookie.
- Fixtures carry no real images, so cards and the hero show the primary colour fallback.
- The iPhone install sheet and banner belong to lane I (PWA); not duplicated.
- Server pages (title, series, account) have no component tests of their own; their client parts do.
- Shared clone has no `remote.origin.fetch` refspec: fetch with `git fetch origin +refs/heads/main:refs/remotes/origin/main`.
