# Client inputs

Everything the client (Sister Vanessa) or the owner has to supply before launch, and where each item plugs in. Nothing here is hardcoded in the platform. Collect these first, then `docs/LAUNCH-RUNBOOK.md` takes about two hours.

Who: the client gives the identity and content. The owner (account holder, usually the client with the developer added as a member) gives accounts and tokens. Secrets never go in chat tools or in git.

## 1. Identity and brand (client)

All of these live in one file, `client.json`, copied from `client.example.json` and applied with `pnpm launch:apply --config client.json`. Validation is strict: a placeholder left in a value (`replace-me`, `change-me`) is refused, and a theme colour pair that fails contrast is reported.

| Input | `client.json` field | Plugs in to | Notes |
|---|---|---|---|
| Platform name | `platformName` | Settings, page titles, PWA name, env `EMAIL_FROM` display name | Plain text |
| Tagline | `tagline` | Settings, home and PWA description | Optional |
| Domain | `domain` | Env `APP_DOMAIN`, `APP_ORIGIN`, Caddy | Without `https://` |
| Media domain | `mediaDomain` | Env `MEDIA_DOMAIN`, `MEDIA_ORIGIN`, Worker custom domain | Defaults to `media.` plus the domain |
| Support email | `supportEmail` | Settings, help page, env `SUPPORT_EMAIL` | |
| Owner email | `adminOwnerEmail` | Who the first owner account is created for | The person who holds the account |
| Colours | `theme.colors` (bg, surface, ink, muted, border, primary, accent) | Theme service, then every screen through tokens | Hex values. Contrast checked |
| Font | `theme.fontKey` | Theme service | One of the allowed keys |
| Type, radius, density | `theme.typeScale`, `radiusScale`, `density` | Theme service | Optional |
| Logo | `logo.path`, `logo.altText` | Logo service, header, emails, PWA icons | PNG or SVG, square or wide, at least 512 px |
| Favicon | `favicon.path` | Favicon service | PNG |
| Terms, privacy, about, help | `legal.<page>.file` or `.html` | Legal pages | Text must be approved by the client. A lawyer should review terms and privacy for NDPA compliance |
| Footer, social links | `footerText`, `socialLinks` | Settings | Optional |
| Languages | `languages.default`, `languages.offered` | Settings, caption languages | Codes such as `en`, `yo`, `ig`, `ha` |
| What visitors see before they choose | `guestAudience` (`general` or `kids`) | Setting `features.guest_audience` (Admin). A visitor can switch Kids mode on or off on their device and that choice wins | Optional, default `general` |
| Can visitors watch without an account | `guestPlay` (`true` or `false`) | Setting `features.guest_play` (Super admin, the emergency switch). Off sends visitors to sign in to watch while browsing still works | Optional, default `true` |

Regenerated from the logo on every apply: the PWA icons (192, 512, maskable, Apple touch). Served from `/brand-icons/`, stored in `BRAND_DIR`.

## 2. Content (client)

A folder of video files and one manifest, `videos.csv` or `videos.json`, imported with `pnpm content:import`. Columns (paths relative to the folder):

| Column | Required | Meaning |
|---|---|---|
| `file` | yes | Video file name |
| `title` | no | Defaults to a title made from the file name |
| `description` | no | Shown on the watch page |
| `category` | no | Created if missing |
| `series`, `season`, `episode` | no | Episode numbers must not repeat inside a series |
| `age_rating` | no | `everyone`, `kids` or `older` (G, PG, 13+ also accepted) |
| `language` | no | Spoken language code, default `en` |
| `script` | no | Text file of the spoken words. Makes captions align to it instead of guessing |
| `poster` | no | Image file |

Accepted video types, the size limits and the quota are enforced by the same upload service as the admin screen. The import validates all rows first and lists every problem together.

## 3. Accounts (owner)

| Account | Needed for | What to record |
|---|---|---|
| Domain registrar | Nameservers to Cloudflare | Owner, renewal date |
| Cloudflare | DNS, proxy, Origin CA, R2, Edge Worker | Owner, plan, the three R2 tokens (kept in a password manager) |
| VPS provider | The server | Owner, region, IP |
| GitHub | Code and image registry | Owner, who can push |
| Email sending provider | Verification and notice emails | SMTP url, sender domain DNS records |
| Optional: Cloudflare Turnstile | Bot protection on sign up | Site key and secret |
| Optional: error reporting (Sentry or GlitchTip) | Error alerts | DSN. Hosted outside Nigeria is a cross border transfer, list it in the privacy notice |
| Optional: uptime monitor and dead man's switch | Alerts and missed backup alerts | Check urls |

## 4. Environment values (owner)

Every variable is documented in `.env.production.example` with a tag: `[generated]` (made by `pnpm secrets:generate`), `[applied]` (set by `pnpm launch:apply --env-only` from `client.json`), `[owner]` (typed in by hand from the accounts above), `[client]` (none are needed beyond `client.json`) or `[default]` (leave alone). The owner values are the R2 endpoint and the two token pairs, the SMTP url, optional Turnstile and error reporting keys, and the backup and monitoring urls.

## 5. Decisions the client may still make

Name, domain, colours and legal text are expected to change. Because they are all configuration, changing one is an edit to `client.json` and a rerun of `apply`, with no code change and no redeploy. Moderation rules, age rating policy and the languages offered are settings in the admin.
