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
| Help centre contact | Setting `help.support_contact` (Site settings, Platform details) | Message ARKDEV strip on the help home. An email address or an https link. Empty shows a placeholder and no link | |
| Storage notice | Settings, Discovery tab: `noticeEnabled`, `noticeText`, `noticeVersion` | Storage notice on public pages | Default text is a placeholder. Bump the version to show it again |
| Search synonyms and share channels | Settings, Discovery tab | Search quality, share menu | Optional. Kids-only titles are never indexed whatever is set |
| Series names | Settings, Series names tab: preset (Season and Episode, Book and Chapter, Part and Lesson, Module and Lesson) or four custom words and an item code | Series pages, cards, Continue learning, notices, search, admin screens | A client question: what words do the Bible series use. Default Season and Episode. One series can override |
| Owner email | `adminOwnerEmail` | Who the first owner account is created for | The person who holds the account |
| Colours | `theme.colors` (bg, surface, ink, muted, border, primary, accent) | Theme service, then every screen through tokens | Hex values. Contrast checked |
| Font | `theme.fontKey` | Theme service | One of the allowed keys |
| Type, radius, density | `theme.typeScale`, `radiusScale`, `density` | Theme service | Optional |
| Logo | `logo.path`, `logo.altText` | Logo service, header, emails, PWA icons | PNG or SVG, square or wide, at least 512 px |
| Favicon | `favicon.path` | Favicon service | PNG |
| Terms, privacy, about, help | `legal.<page>.file` or `.html` | Legal pages | Text must be approved by the client. A lawyer should review terms and privacy for NDPA compliance |
| Maturity labels | Setting `maturity.labels`: five comma separated labels of 1 to 4 characters, all different (default G, PG, 12, 15, 18) | Maturity badge, profile limit select, admin rating select (M44) | Short labels the client approves for her audience |
| Guest maximum rating | Setting `maturity.guest_max_rank` (0 to 4, default 2) | What a visitor without an account may see (M44) | A number the client chooses |
| Footer, social links | `footerText`, `socialLinks` | Settings | Optional |
| Languages | `languages.default`, `languages.offered` | Settings, caption languages | Codes such as `en`, `yo`, `ig`, `ha` |
| Home sections | `home.seedDefaults`, `home.continueTitle`, `home.newTitle`, `home.trendingTitle` | Home sections (Admin, Home curation) | Optional. On a new site `apply` publishes six sections: Continue learning, My List, New this week, Most watched this week, Browse by subject, Series. It never touches a layout that already exists. Set `seedDefaults` to `false` to skip it |
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
| Optional: Google Cloud OAuth client (M49) | Continue with Google on Sign in and Sign up | Client id and secret, set as `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` (both or neither). Create a Web application client with the redirect URI `<APP_ORIGIN>/api/auth/google/callback` and fill in the consent screen with the platform name and logo. Without the keys the Google button is hidden |
| Optional: Cloudflare Turnstile | Bot protection on sign up | Site key and secret |
| Optional: error reporting (Sentry or GlitchTip) | Error alerts | DSN. Hosted outside Nigeria is a cross border transfer, list it in the privacy notice |
| Optional: uptime monitor and dead man's switch | Alerts and missed backup alerts | Check urls |

## 4. Environment values (owner)

Every variable is documented in `.env.production.example` with a tag: `[generated]` (made by `pnpm secrets:generate`), `[applied]` (set by `pnpm launch:apply --env-only` from `client.json`), `[owner]` (typed in by hand from the accounts above), `[client]` (none are needed beyond `client.json`) or `[default]` (leave alone). The owner values are the R2 endpoint and the two token pairs, the SMTP url, optional Turnstile and error reporting keys, and the backup and monitoring urls.

## 5. Decisions the client may still make

Name, domain, colours and legal text are expected to change. Because they are all configuration, changing one is an edit to `client.json` and a rerun of `apply`, with no code change and no redeploy. Moderation rules, age rating policy and the languages offered are settings in the admin.

## 6. Donations and sponsors (client, owner)

Nothing here is hardcoded. Each item maps to a setting in Settings, Monetization, or to a record in the admin.

| Needed from the client | Where it goes | Notes |
|---|---|---|
| Organisation legal name | `donate.org_name` | Shown on the Donate page and on receipts |
| Registration number (optional) | `donate.org_registration` | |
| Paystack account, test and live secret keys | `PAYSTACK_SECRET_KEY` on the server | Owner pastes it into the server secrets, never into chat or settings |
| Support or receipt reply email | `donate.receipts.reply_to` or the support email | |
| Preset amounts, smallest and largest gift | `donate.presets_minor.ngn`, `donate.min_minor.ngn`, `donate.max_minor.ngn` | In kobo |
| Page wording (title, text, thank you) | `donate.intro_*`, `donate.thank_you_*` | Draft wording is provided |
| USD gifts (optional) | `donate.usd.enabled` | Needs Paystack international payments and a USD account |
| Bank details for transfers (optional) | `donate.bank_transfer.instructions`, switch `donate.bank_transfer.enabled` | Plain text, shown on the Donate page only when the switch is on |
| Transparency page content | `donate.transparency.*` | Percentages that total 100, or amounts; the owner must supply real figures |
| Tax or receipt wording | Not configured | Receipts make no tax claim until the owner and an adviser decide |
| Sponsor terms and sponsors themselves | Admin, Sponsors | Names, links and images come from each sponsor |

## 7. Languages and translations (client)

Launch is English only. Each item below is a setting or an admin task, nothing is hardcoded.

| Needed from the client | Where it goes | Notes |
|---|---|---|
| Which interface languages to turn on | Admin, Languages (`content.ui_languages`) | Off until a language reaches the publish threshold (`i18n.publish_min_percent`, default 80 percent of core text) |
| Which caption languages to offer | Site settings (`content.languages`) | Yoruba, Igbo, Hausa, Pidgin are possible; English always |
| A native reviewer for each language | Admin accounts with Admin role to approve | Sample drafts exist for Yoruba, Igbo and Hausa and are marked unreviewed. Pidgin has no draft |
| Volunteer translators | Sister Vanessa exports a CSV and imports the result | Imports land In review and need an Admin to approve |
| Caption translation engine | `TRANSLATE_PROVIDER`, `TRANSLATE_API_KEY`, `TRANSLATE_MONTHLY_CHAR_CAP` | Default none. NLLB is non commercial, so with sponsors on use a paid API or a commercially licensed engine (R23) |
| Multilingual speech model | `WHISPER_MODEL_MULTI` | Needed to caption Yoruba or Hausa audio automatically. Igbo and Pidgin are uploaded or aligned |
| Names of the languages in the picker | Built in (endonyms) | The client may correct spelling and tone marks |
| Glossary of protected words | `translation.glossary` | Names and brand words that translation must not change |
| Privacy page line about a hosted engine | Pages editor | Only when a hosted engine is switched on |
