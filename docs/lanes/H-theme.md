# Lane H: Theme settings and site configuration

Modules M18 (theme settings) and M29 (site configuration). Package `@ad/theme`, plus admin screens in `apps/web`.

## Routes

- `/admin/theme` (S56): colour pickers with hex fields and ratio badges, font and size controls, live Home and Watch preview, reset, publish.
- `/admin/theme/history` (S57): versions with restore.
- `/admin/site-settings` (S64): platform details, features and limits, legal and info pages with versions, maintenance, launch checklist.

Permissions: `settings.theme` and `settings.site` through `can()`. Viewers are read only.

## Package exports

- `@ad/theme`: `ThemeService`, `SettingsService`, `getThemeInjection`, `themeStyleProps`, `LogoUploader`, `createDrizzleThemeStore`, `createDrizzleSettingsStore`, `createDrizzleAssetStore`, contrast, derive, gate, model, css, sanitiser, settings registry (`SETTING_DEFS`).
- `@ad/theme/client`: browser safe subset (no database, sharp or storage).
- `@ad/theme/testing`: in-memory stores.

## Behaviour

- Save gate (D-007): ink or muted on bg or surface below 4.5:1 blocks. On-primary and on-accent text is auto chosen; below 2 blocks, 2 to 4.5 warns and needs acknowledgement on publish. Border and focus colours are derived to reach 3:1.
- Versions: one draft, one published, archived rows. Publish archives the old published row and busts the cache (60 second TTL otherwise). Restore and reset create a new draft. Writes take an advisory lock and write the audit row in the same transaction.
- Settings: 28 typed keys with safe defaults; falls back to defaults if the database read fails. Legal pages are stored as `pages.<slug>`; publishing terms or privacy bumps `legal.terms_version` or `legal.privacy_version`.
- Logo: PNG, JPEG or WebP up to 500 KB, 32 to 4096 px, re-encoded to WebP. SVG and animated images are rejected.

## Root layout (lane E)

Helper: `apps/web/src/lib/theme/root.ts`. Never throws.

```tsx
import { getRootTheme } from '@/lib/theme/root';

export async function generateViewport() {
  const t = await getRootTheme();
  return { themeColor: t.injection.themeColor };
}

export default async function RootLayout({ children }) {
  const nonce = (await headers()).get('x-nonce') ?? undefined;
  const t = await getRootTheme(nonce);
  return (
    <html lang="en">
      <head>
        <style {...t.styleProps} />
      </head>
      <body>{children}</body>
    </html>
  );
}
```

Fonts: files live in `apps/web/src/fonts` and must be served at `/fonts/{key}.woff2` (or pass `fontBaseUrl`).

## Environment

`ADMIN_THEME_STORE=db` switches the screens from the in-memory fixture runtime to Postgres.

## Scoped tests

```
pnpm vitest run packages/theme
pnpm vitest run apps/web/src/components/admin/theme apps/web/src/components/admin/site
pnpm vitest run apps/web/src/lib/data/admin/theme.test.ts apps/web/src/lib/data/admin/site-settings.test.ts
TEST_DATABASE_ADMIN_URL=... pnpm vitest run packages/theme/src/drizzle-store.int.test.ts packages/theme/src/settings-store.int.test.ts
```

## Gaps

- Invite codes tab not built.
- No super admin tier (D-025, D-034); flag changes need admin.
- History shows names only for the current actor.
- Mobile preview does not change @ad/ui media queries.
- No visual or Playwright check (browsers not installed).
- DB mode wiring is not tested end to end.
- A shared audit writer from `@ad/security` could replace the in-transaction audit.
