# L7 Languages: UI translations and caption translations (module M46)

Status: planning pass, docs only. Nothing in this file is built. Source evidence: `docs/audits/2026-11-24-netflix-rea-audit.md` (section 4 lists "Yoruba, Igbo, Hausa, Pidgin UI and caption translations" as missing; section 5 makes guests first class, so language choice must work without an account), `CLAUDE.md`, `docs/USER-STORIES.md`, `docs/DESIGN-SYSTEM.md`, the `angels-delight-design-system` skill, and the code paths named below, all read on 24 November 2026 at origin/main 08d6e86.

Confidence tags: verified (read in this repo or measured here), inferred (reasoned, tune or measure at build time).

## 1. Scope

In scope
- Message catalogs for Yoruba (`yo`), Igbo (`ig`), Hausa (`ha`) and Nigerian Pidgin (`pcm`), with English (Nigeria) `en` staying the default and the source of truth.
- Locale selection: guest cookie, account and profile setting, Accept-Language default, no URL prefix (recommended, section 4.2).
- Per key fallback to English, with reporting of what viewers actually hit.
- A translation workflow in `/admin` that Sister Vanessa or volunteers can use: status screen, edit workspace, export and import, missing key report, review and approve, publish a language.
- Fonts and diacritics: a measured gap (section 3) and its fix.
- Plural, number, date and duration formatting per locale. RTL is not required and is not built.
- Caption translations: machine translation triggered by an admin (never by a viewer), human review in the existing caption review screen, a publish switch per language, a player menu that lists only approved and published languages.
- Whisper language detection and non-English audio.
- Translation engine choice, cost, offline and self hosting.

Out of scope (each is a logged decision, section 11)
- Translating the admin interface (staff work in English), legal and About page bodies (admin authored, one language), video titles and descriptions (authored text, not UI copy), audio dubbing, RTL, a locale URL prefix, voice search.
- Emails and the offline page are Should and Could slices (S17), not launch blockers.

Launch stays English only (PRD line 47 stands). L7 is phase 2 work that must be switch off safe: with `content.ui_languages = ['en']` and `content.languages = ['en']` the platform behaves exactly as today, no picker is drawn, no caption menu appears.

## 2. Findings from the code read (what the plan must deal with)

1. The catalog is small and barely wired. `packages/shared/src/messages/en-ng.ts` has 81 keys. Only 8 files are on the D-158 lint list (`eslint.config.js`). The repo has 258 non-test `.tsx` files in `apps/web/src`, `packages/ui/src` and `packages/player/src`, and a crude grep finds at least 415 inline label and sentence literals (verified, a floor not a count). Translating anything useful means a copy extraction program first (slice 7). This is the biggest cost in the lane.
2. `formatDuration` in `messages.ts` hardcodes "min" and "hr", and plural choice is `count === 1`. Both are English only (verified). Hausa has a `one` category, Yoruba and Igbo have only `other` in CLDR (inferred, test reads `Intl.PluralRules` at build time rather than trusting this).
3. `createMessages` already falls back per key to `en-NG` and reports once per key through `onMissing` (verified, `messages.ts`). That is the right shape; the report only goes to `console.warn`, so nothing is collected yet.
4. Bug found: `packages/video/src/captions/generator.ts` line 95 calls the transcriber with `language: 'en'` while line 108 creates the track with `video.language`. A video marked `yo` would be recognised as English and stored as a Yoruba track (verified).
5. Whisper is English only today: `WHISPER_MODEL` defaults to `small.en` in `apps/whisper/server.py`, `docker-compose.yml` and the Dockerfile. Whisper's language list includes Yoruba and Hausa but not Igbo or Pidgin (inferred from the published language list, confirm against the faster-whisper version pinned in `apps/whisper/requirements.txt`). Quality for yo and ha is weak; `docs/ARCHITECTURE.md` line 294 already says so.
6. The caption admin is English only by construction: `apps/web/src/lib/data/admin/real/captions.ts` hardcodes `'en'` at six places, `listAdminCaptionRows` joins only `ct.language = 'en'`, and `ensureTrack` defaults the label to `'English'` (verified).
7. The viewer side is already language shaped: `caption_tracks` is unique per `(video_id, language)`, `caption_source` already has `translation`, `CaptionService.hasApprovedCaptions(videoId, language)` and `publicCaptions` exist, the player picks `prefs.captionLanguage` and otherwise `tracks[0]` (`controller.ts` line 955, the wrong fallback once several languages exist), and `CaptionRows` hardcodes "Off" (verified).
8. Settings already exist: `content.default_language`, `content.languages` ("Caption languages"), `accounts.locale` (default `en`), `profiles.language` (default `en`), `profiles.playbackPrefs.captionLanguage`. `ProfileForm.tsx` offers only English. `apps/web/src/app/layout.tsx` hardcodes `<html lang="en">` (verified).
9. Fonts: the shipped subsets do not contain ẹ ọ ị ụ in any of the six families (section 3, measured with fontTools). `docs/DESIGN-SYSTEM.md` section 5.1 says Latin plus Latin Extended carries the Yoruba and Igbo marks. That statement is wrong for the dot below vowels and needs correcting in this lane.

## 3. Fonts and diacritics check (measured)

Method: opened every `apps/web/src/fonts/*.woff2` with fontTools and checked these code points per family (union of the base and latin-ext files): ẹ U+1EB9, ọ U+1ECD, ị U+1ECB, ụ U+1EE5, ṣ U+1E63, ṅ U+1E45 and their capitals, combining grave U+0300, acute U+0301, macron U+0304, dot below U+0323, plus è é ń.

| Family | Missing today |
|---|---|
| Inter | ẹ ọ ị ụ and capitals |
| Nunito | ẹ ọ ị ụ and capitals |
| Space Grotesk (display only) | ẹ ọ ị ụ and capitals |
| DM Sans | ẹ ọ ị ụ ṣ ṅ, capitals, combining dot below |
| Lora (display only) | ẹ ọ ị ụ ṣ ṅ and capitals |
| Poppins | all of the above plus combining grave, acute, macron |

Cause (inferred from the Google Fonts and Fontsource split): U+1EA0 to U+1EF9 sits in the `vietnamese` subset, not `latin-ext`. Poppins has no vietnamese subset upstream, so it cannot be fixed by adding a file.

Consequence: Yoruba and Igbo text would render ẹ ọ ị ụ in a system fallback font, mixed into brand type, on exactly the low end Android phones this product targets. Tone marks on those vowels (ọ́, ẹ̀) need the combining marks to be positioned by GPOS; every family has GPOS except where the mark glyph is absent (Poppins).

Plan (slice 6)
- Add the `vietnamese` WOFF2 subset for Inter, DM Sans, Nunito, Lora, Space Grotesk (SIL OFL, same licence files already shipped). Load with `next/font/local` `declarations: [{ prop: 'unicode-range', value: '...' }]` and `preload: false`, so the file downloads only when a page contains those code points. English pages pay nothing.
- Poppins: keep as is and make the stack `Poppins, Inter` so ẹ ọ ị ụ and the marks fall back per glyph to Inter (bundled, same neutral style). Space Grotesk and Lora are display only, so headings fall back per glyph to Inter the same way.
- Build time check, `apps/web/src/lib/fonts-coverage.test.ts`, reads every shipped subset with `fontkit` (new devDependency, MIT; if the owner objects, a Python fontTools script under `scripts/` is the fallback) and fails if any code point used by any approved catalog (NFC) or by the pseudo locale is not covered by the family or by Inter.
- Caption cues: `::cue` text uses the player font stack, so `packages/player/src/player.css` and `captionStyle.ts` must name the same fallback chain. Test: `captions-css.test.ts` gets a case.
- Rendering rules for `:lang(yo)` and `:lang(ig)` (and `ha`, `pcm` for symmetry), as tokens in `packages/ui/src/tokens.css`: heading line height token `--leading-marks: 1.3` instead of 1.15 so stacked marks (dot below plus acute) are not clipped; `letter-spacing: 0` on micro labels (letter spacing can detach combining marks in some engines); a `padding-block: 0.1em` on line clamped titles so `overflow: hidden` does not cut a dot below on the last line.
- Normalise everything to NFC on save, import and export; compare in NFC. Excel and some Android keyboards emit decomposed forms.
- Naira sign ₦ U+20A6 is in latin-ext (inferred); it is on the glyph test list.
- `docs/DESIGN-SYSTEM.md` 5.1 is corrected in the same PR, and new tokens are added to `tokens.css`, section 3 and the theme editor group (Fixed) together, as the design skill requires.

## 4. Design

### 4.1 Locale model

`packages/shared/src/messages/locales.ts` (new) exports `LOCALES`:

| code | bcp47 and html lang | endonym | English name | Intl locale (then fallback) | status |
|---|---|---|---|---|---|
| `en` | `en-NG` | English | English | `en-NG` | source |
| `yo` | `yo` | Yorùbá | Yoruba | `yo-NG`, then `en-NG` | translatable |
| `ig` | `ig` | Igbo | Igbo | `ig-NG`, then `en-NG` | translatable |
| `ha` | `ha` | Hausa | Hausa | `ha-NG`, then `en-NG` | translatable |
| `pcm` | `pcm` | Naijá | Nigerian Pidgin | `pcm`, then `en-NG` | translatable |

Stored values are the short codes, matching the existing columns (`en` today). British English spelling stays in `en`; no separate `en-GB` catalog. `normalizeLocale()` maps `yo-NG`, `ha-Latn-NG`, `EN-gb` to a code, rejects anything else, and bounds input at 35 characters (same as `accounts_locale_length`). The Pidgin endonym is shown as "Naijá" with "Nigerian Pidgin" beneath; the stories' word "Pidgin" is the English name.

A dev only pseudo locale `xx` (flag `DEV_PSEUDO_LOCALE`, rejected in production like `WHISPER_FAKE`) wraps every string with ẹ ọ ṣ ị ụ and tone marks and lengthens it by 40 percent, for layout and font QA without a translator.

### 4.2 Locale selection (recommended: no URL prefix)

Recommendation: no locale prefix. Reasons: guests are first class and there is no sign up wall, so a cookie covers them; there is no sitemap, hreflang or robots yet (audit section 4), so a prefix buys no SEO today; prefixes would touch every route, every `next` redirect, the service worker scope and the playback token routes, for no viewer benefit. `?lang=yo` is accepted anywhere, sets the cookie, and the page is served in that language (links shareable). Revisit when SEO work lands (reversible: a prefix can be added later with redirects from the cookie).

Resolution order, first match among enabled locales (`content.ui_languages`):
1. `?lang=` query (explicit, also writes the cookie).
2. Signed in with a selected profile: `profiles.language`. Else `accounts.locale`.
3. Cookie `ad_locale` (guests, signed out, and the picker on a shared device). Functional cookie, SameSite Lax, Secure, 365 days, no tracking, mentioned in the NDPA brief next to `ad_guest`.
4. Accept-Language best match using q values (`yo`, `yo-NG`, `ha`, `ig`, `pcm`; any `en-*` maps to `en`).
5. `content.default_language`.

`apps/web/src/proxy.ts` (already the request hook, Next 16 proxy) does steps 1, 3, 4 without a database and forwards `x-ad-locale-hint`. `getLocale()` in `apps/web/src/lib/i18n/server.ts` adds step 2 from the session. The picker writes both the cookie and (when signed in) the profile. A kids profile uses its own `profiles.language`, set by the parent in the profile form; the picker is hidden in kids profiles (same rule as M26-S05).

Caching: pages that read the locale vary on `Cookie` and `Accept-Language`; no shared CDN cache of HTML exists today (inferred from the dynamic viewer pages), so there is no cache poisoning risk, but a test asserts `Vary` is set on locale dependent public pages when the audit's SEO work makes them cacheable.

`<html lang>` is set from the resolved locale; text from another language inside a page (a Yoruba video title on an English page, the caption language rows) carries its own `lang`.

### 4.3 Catalogs, merge order, fallback

- English: `en-ng.ts` stays the typed source. Keys stay `area.kind.name`.
- Baseline per locale: `packages/shared/src/messages/locales/{yo,ig,ha,pcm}.json` (flat key to string, or a plural object keyed by CLDR category). Committed, reviewed in PRs, available offline, seeded empty `{}` in slice 2.
- Working store: DB table `ui_translations` for edits made in admin between releases (draft, in_review, approved).
- Effective text for a key: approved DB row, else baseline JSON, else English. Missing at every level shows English and is recorded in `ui_missing_keys`. Admin "Export" produces the effective catalog so ARKDEV can commit it as the next baseline (keeps git as the long term record, keeps volunteers off deploys).
- Stale detection: each translation stores `source_hash` (sha256 of the English text when translated). If English changes, the key shows "Source changed" in admin. Viewers keep seeing the old translation until it is reviewed (decision L7-D6), because English edits are mostly typo fixes. A developer who changes meaning must change the key name, which makes it missing, not stale.
- Plurals: `{one, other}` becomes `Partial<Record<Intl.PluralRulesCategory, string>>` with `other` required, chosen by `Intl.PluralRules(intlLocale)`, falling back to English rules if the engine has no data. The translation workspace shows exactly the categories the locale uses.
- Validation (shared by editor save and import): same `{placeholders}` as English (no extras, none missing), plural categories complete for the locale, plain text only (no HTML), no U+2013 or U+2014 (project copy rule, error not warning), NFC, length at most 2.5 times English (warning, layout risk), non empty.
- Bundle size: translation is resolved on the server. Client components get a provider carrying only the namespaces the route needs (`common`, `player`, `account` and so on, the first key segment), budget 15 KB gzipped for the shell namespace per locale (inferred, measure). The player package takes a `t: Translate` prop instead of importing the `msg` singleton, so the player can be locale aware without importing the web app.
- Service worker: catalog responses are not cached separately because text arrives with rendered HTML or the page props; the offline page uses a small inline table (S17).

### 4.4 Translation workflow for Sister Vanessa and volunteers

No new role at launch (decision L7-D16). Editors can edit drafts, Admin and Super admin approve and publish. Volunteers without accounts work in a spreadsheet: Sister Vanessa exports, sends the file, imports the result. Imports land as `in_review`, never approved, so a spreadsheet cannot publish anything.

Screens (new, all under the admin shell, tokens and components of DESIGN-SYSTEM 11.16 and 11.25):
- `/admin/languages`: one row per locale with endonym, state (Off, Draft, Live), approved percent of keys, missing, stale, in review, last change, Publish switch, Export, Import.
- `/admin/languages/[locale]`: workspace. Filters Missing, Stale, In review, Approved, All; area filter; search on key and text. Each row shows the key, the English text, an editable translation, placeholders as chips, a plural editor when the key has plurals, per row Save and Approve, "Copy English" for brand words, a character count against the English length. Bulk approve with count and a warning when any selected row has a validation warning (same component as caption bulk approve, owner punch list item 4).
- Missing key report tab: keys viewers hit in English instead of the locale, sorted by hits, with last seen date. This is the "what to translate first" list, and it differs from "absent from the catalog" because it reflects real traffic.
- Export: JSON (flat) and CSV (`key,area,english,translation,status,note`) with a UTF-8 BOM, because Excel mis-reads diacritics in BOM less CSV (verified behaviour of Excel, common cause of broken ọ). Import accepts both, with or without BOM, max 2 MB and 5,000 rows, shows a dry run (added, changed, unchanged, rejected with a reason per row) before anything is written.
- Publishing a language (`content.ui_languages`) is blocked below `i18n.publish_min_percent` approved core keys (default 80) unless a Super admin overrides with a reason, audited. "Core" is a tag list (`CORE_KEYS` in `locales.ts`: shell, auth, player, account).
- Every approve, import, publish and override is an audit event.

### 4.5 Caption translations

Data (additive migration, section 6): `caption_tracks.published boolean not null default true`; `captions.source_caption_id uuid null` (the revision translated from) and `captions.source_sha256 bytea null`. `captions.model` already records the engine. Translation tracks use `kind = 'subtitles'`, `source = 'translation'` (enum value exists), label = the endonym.

Flow
1. Admin opens a video's captions, chooses Add translation, picks a language (only languages in `content.languages` that the provider supports), sees the estimate (characters, API cost or CPU minutes), confirms. A `caption.translate` job is queued.
2. The worker takes the approved revision of the video's spoken language track, batches cue texts (about 20 cues per request with numbered separators to keep alignment; falls back to cue by cue if the count of returned lines differs), protects glossary terms (`translation.glossary`: platform name, program names, names of people), translates, NFC normalises, runs `sanitizeCueText`, reflows to 2 lines of 42 characters (`MAX_LINE_CHARS`), and stores a revision through `storeRevision` as `in_review`, `published = false`. Cue timings are copied unchanged. Validation warnings from `validateCues` go to the review screen.
3. A human reviews in the existing caption review screen (`CaptionReview.tsx`) in translation mode: language tabs, the English cue beside each translated cue, timing locked by default (editing a time shows a warning), the same autosave, undo, find and replace, approve with confirmation when warnings exist.
4. Approve makes the revision `approved` (existing `captions_approved_is_reviewed` check applies). Publishing is a separate per language switch, per video and across the library: a viewer sees a track only if it is approved, `published`, and its language is in `content.languages`. The site wide switch is the kill switch for a language found to be bad.
5. "Source changed" is computed, not stored: translation `source_sha256` differs from the sha of the current approved source revision. Admin sees a badge and a Retranslate or Still correct action. Viewers keep the approved translation.

Machine translation on demand by viewers is not offered (decision L7-D8): unreviewed text would reach children and the cost is open ended. "On demand" means an admin can trigger it for one video at any time, or for a whole language in bulk (S16).

Whisper and non-English audio (slice 16)
- `videos.language` already exists. Add an "Spoken language" select to the video details form (en, yo, ha, pcm, ig, Auto). Upload default is `content.default_language`.
- Generator passes the real language (fixes finding 4). `auto` omits the language so faster-whisper detects; the server returns `language` and `language_probability` (new). If detection is at least 0.6 the video is updated and the review note says "Detected Yoruba"; below that the note says "Spoken language uncertain, check the captions", and the track stays `needs_review` as always.
- Models: keep `small.en` for English (fast, accurate). Add an optional second model `WHISPER_MODEL_MULTI` (recommended `medium`, int8, roughly 1.5 to 2 GB RAM, inferred) used for any non-English language and for `auto`. Unset means non-English audio is refused with a clear admin message ("This server only recognises English. Upload a caption file or align a script."), never a silent English transcription.
- Igbo audio: Whisper has no Igbo, so generation is not offered for `ig`; admin uploads a `.vtt` or `.srt` (M15-S09). Forced alignment of a script (M15-S02) also depends on recognition, so it is limited to en, yo, ha. A script alignment path for Igbo using a wav2vec2 style aligner is noted as a future Could, unproven here.
- Pidgin audio: map `pcm` to Whisper `en` (Pidgin is close enough to decode as English words; quality is mediocre, review is mandatory as always). Verified as design only, measure on two real Pidgin clips before launch.
- Publish gate (M15-S10): an approved track in the video's spoken language, not necessarily English.
- Translation source: always the approved track in the spoken language. A Yoruba spoken video can get an English subtitle track by the same job (NLLB translates any listed pair directly).

### 4.6 Translation engine options (self hosted or API with an admin key)

| Option | Runs | Covers yo, ig, ha | Pidgin | Licence and cost | Notes |
|---|---|---|---|---|---|
| NLLB-200 distilled 1.3B (or 600M) through CTranslate2, int8, CPU | Self hosted sidecar, offline after the model is on the volume | Yes (yor_Latn, ibo_Latn, hau_Latn) | No | Weights CC-BY-NC 4.0 (non commercial). No per use cost. About 1.5 to 2.5 GB RAM for 1.3B, 1 GB for 600M (inferred) | Same sidecar pattern as `apps/whisper`. Recommended default. |
| MADLAD-400 3B | Self hosted | Yes | Not reliably | Apache-2.0 weights; 3 to 4 GB RAM int8 (inferred), slower | Fallback if the NLLB licence is a problem |
| Google Cloud Translation (v3 NMT) | API, key or service account as a secret | Yes, verify at build | No | Paid per character, about USD 20 per million characters at the time of writing (verify). A 10 minute talk is about 9,000 characters, so 200 videos is about 1.8 million characters, about USD 36 per language (inferred) | Best quality per effort; sends text to Google, which the NDPA brief must mention |
| LLM through the Anthropic API (admin key as a secret) | API | Usable, tone mark accuracy not reliable | Yes, the only option that drafts Pidgin | Paid per token | Pidgin draft and optional polish pass only, always reviewed |
| DeepL, Argos Translate | | No yo, ig, ha (verify) | No | | Rejected |

Recommendation: NLLB-200 distilled 1.3B on a new private `apps/translate` sidecar for yo, ig, ha. It is free to run, works offline once the model is on the volume, and fits the self hosted stack. Pidgin has no good engine: leave it human first (translators work from the English catalog and captions), with an optional LLM draft when `TRANSLATE_PCM_PROVIDER=llm` and a key are set. A provider interface (`Translator`) means switching to Google is configuration only. The NLLB licence is a genuine owner question (section 12).

Config (environment, secrets never in the database or admin UI; admin shows "Configured" or "Not configured" and the engine name only):
- `TRANSLATE_PROVIDER`: `none` (default) | `nllb` | `google` | `llm` | `fake` (`fake` rejected in production like `WHISPER_FAKE`).
- `TRANSLATE_URL`: sidecar URL, required for `nllb`, a private network address.
- `TRANSLATE_API_KEY`: secret for `google` and `llm`. Required when those providers are chosen (checked in `packages/config/src/env.ts`, same style as the Turnstile pair check).
- `TRANSLATE_PCM_PROVIDER`: `none` (default) | `llm`.
- `TRANSLATE_MODEL`: NLLB size (`nllb-200-distilled-1.3B`) or LLM model id. Deploy only variable list gets `TRANSLATE_MODEL` and `TRANSLATE_COMPUTE_TYPE`.
- `TRANSLATE_MAX_CHARS_PER_JOB`: default 60000.
- `TRANSLATE_MONTHLY_CHAR_CAP`: default 0 meaning no API use. A table `translation_usage(month, provider, chars)` counts and the job refuses with a plain message when the cap would be crossed (cost guard for API providers; not applied to `nllb`).
- Admin settings (registry, tier admin): `content.ui_languages` (default `['en']`), `content.languages` (existing, caption languages, default `['en']`), `i18n.publish_min_percent` (default 80), `translation.glossary` (text, 4 KB), `captions.translation_publish_default` (default false).

Cost and offline summary: with `nllb` there is no per use cost and no internet needed after setup; CPU time is roughly 1 to 3 minutes for a 10 minute video on 4 vCPU (inferred, measure) and the queue runs one job at a time (`concurrency: 1`) so playback encoding is not starved; the sidecar is a compose profile (`translate`) that is off unless used. Memory is the real budget: whisper multilingual (+1.5 to 2 GB) and NLLB 1.3B (+2 GB) are both optional (owner question on server size). With an API provider the worker needs outbound HTTPS only for that host.

## 5. Detailed build list

All slices: branch from a fresh worktree, one PR per slice, tests first and only that file run (`pnpm vitest run <path>`), `scripts/footprint-check.sh` and the dash and emoji grep before each commit, decisions appended to `docs/DECISIONS.md` with the next free D-number (highest on origin/main today is D-168; the ids L7-D1 to L7-D17 below are placeholders), lane notes in `docs/lanes/L7.md`. Migration numbers: next free at build time (0036 on today's main); the file names below use `00NN` and must be renumbered if another lane merged first. DB integration tests need `pg_ctlcluster 16 main start` and `TEST_DATABASE_ADMIN_URL` as in DEV-SETUP.md.

Order and dependencies: 1, 2, 3 are the foundation; 4 and 6 can run in parallel after 2; 7 is a long running wave program that starts after 2 and continues; 8 to 11 need 2 and 3; 12 to 15 need 3; 16 needs only the existing caption code and can start any time after 3.

### Slice 1. Locale registry, plurals, numbers, dates, durations
Files: new `packages/shared/src/messages/locales.ts`, `format.ts`; edit `messages.ts`, `index.ts`, `en-ng.ts` (adds `format.duration.min`, `format.duration.hr`, `format.duration.hrMin`, `format.today`, `format.yesterday`).
Tests first
- `packages/shared/src/messages/locales.test.ts`: "LOCALES lists en, yo, ig, ha and pcm with endonyms and html lang", "normalizeLocale maps yo-NG, ha-Latn-NG and EN-gb to codes", "normalizeLocale rejects unknown codes and input over 35 characters", "parseAcceptLanguage orders by q and ignores malformed tags", "pickLocale returns the first enabled match and else the default".
- `packages/shared/src/messages/format.test.ts`: "pluralCategory uses Intl.PluralRules for the locale", "pluralCategory falls back to English rules when the engine has no data", "formatNumber falls back to en-NG when the locale has no number data", "formatDate gives 17 Nov 2026 for en", "formatDate falls back to en-NG for a locale without month names", "formatDuration reads min and hr from the catalog for a locale", "formatDuration keeps 6 min, 1 hr and 3 hr 40 min for en".
- extend `messages.test.ts`: "a plural object with only other works for a locale without one", "a missing plural category falls back to other", "missing key reports locale and key once".
Config: none. Migration: none.

### Slice 2. Catalog loader, merge, validation, namespaces
Files: new `packages/shared/src/messages/validate.ts`, `merge.ts`, `locales/yo.json`, `locales/ig.json`, `locales/ha.json`, `locales/pcm.json` (all `{}`), `packages/shared/src/messages/pseudo.ts`; new `apps/web/src/lib/i18n/server.ts` (`getLocale`, `getTranslator`), `provider.tsx` (`I18nProvider`, `useT`), `namespaces.ts`; edit `index.ts`. The player gets a `t` prop in slice 5.
Tests first
- `packages/shared/src/messages/validate.test.ts`: "rejects a translation that drops a placeholder", "rejects an extra placeholder", "requires the plural categories the locale uses", "rejects em and en dashes", "rejects HTML", "normalises to NFC", "warns above 2.5 times the English length".
- `packages/shared/src/messages/merge.test.ts`: "approved DB text beats baseline JSON beats English", "draft DB text is ignored", "missing everywhere returns English and records the key".
- `packages/shared/src/messages/pseudo.test.ts`: "pseudo text keeps placeholders", "pseudo text is about 40 percent longer", "pseudo text contains ẹ ọ ṣ ị ụ and a tone mark".
- `apps/web/src/lib/i18n/namespaces.test.ts`: "only the requested namespaces reach the client", "an unknown namespace is an error in dev and ignored in production".
- extend `apps/web/src/lib/messages-coverage.test.ts`: "every locale JSON key exists in en-ng", "every locale JSON value passes validation".
Config: `DEV_PSEUDO_LOCALE` (bool, default false, rejected in production) in `packages/config/src/env.ts`.

### Slice 3. Migration and schema
Files: new `packages/db/migrations/main/00NN_i18n_and_caption_languages.sql`, `packages/db/src/schema/i18n.ts`; edit `packages/db/src/schema/captions.ts`, `schema/index.ts`, `schema/enums.ts` (enum `ui_translation_status`: draft, in_review, approved), `packages/shared/src/enums.ts` (`UI_TRANSLATION_STATUSES`), `docs/DATA-MODEL.md`.
Migration (additive, no drops)
- `ui_translations(id, locale text, key text, text jsonb, status ui_translation_status default 'draft', source_hash bytea, note text, updated_by uuid references accounts on delete set null, reviewed_by uuid same, reviewed_at timestamptz, updated_at, created_at)`, unique `(locale, key)`, check locale in the five codes, check `char_length(key) between 3 and 120`, index `(locale, status)`.
- `ui_missing_keys(locale text, key text, hits integer, first_seen, last_seen, primary key (locale, key))`.
- `translation_usage(month date, provider text, chars bigint, primary key (month, provider))`.
- `caption_tracks.published boolean not null default true` (backfills true, so every existing approved track stays visible); check `published` is true or the track is not the only default (not needed, skip).
- `captions.source_caption_id uuid references captions(id) on delete set null`, `captions.source_sha256 bytea`; check `source = 'translation' or source_caption_id is null`.
- RLS and grants follow the existing pattern for admin tables (copy from the migration that created `captions`); `ui_missing_keys` is insert and update for the web role through a SECURITY DEFINER function so a viewer request can record a hit without any account.
Tests first: `packages/db/src/schema.int.test.ts` additions or new `packages/db/src/i18n.int.test.ts`: "ui_translations is unique per locale and key", "ui_translations rejects an unknown locale", "ui_translations rejects a key over 120 characters", "caption_tracks.published defaults to true for existing rows", "a translation caption may reference its source revision", "a non translation caption may not carry a source revision", "recording a missing key twice increments hits", "a viewer role can record a missing key but cannot read ui_translations drafts".

### Slice 4. Locale resolution
Files: new `apps/web/src/lib/i18n/resolve.ts`, `cookie.ts`; edit `apps/web/src/proxy.ts` (forward `x-ad-locale-hint`, handle `?lang=`), `apps/web/src/app/layout.tsx` (`lang` from resolved locale, provider), `apps/web/src/server/data/real-profiles.ts` and `real-account-data.ts` (validate `language` and `locale` against `LOCALES`, not the loose regex), `packages/theme/src/settings-registry.ts` (new keys), `packages/launch/src/apply.ts` (already maps `languages.default`; add `ui_languages`).
Tests first
- `apps/web/src/lib/i18n/resolve.test.ts`: "query beats profile beats account beats cookie beats Accept-Language beats default", "a locale that is not enabled is skipped at every step", "a guest with no cookie gets the Accept-Language match", "yo-NG and ha-Latn-NG resolve to yo and ha", "no match falls to the site default", "a kids profile uses its own language".
- `apps/web/src/lib/i18n/cookie.test.ts`: "sets ad_locale with Lax, Secure, 365 days and no HttpOnly requirement for the picker", "ignores a forged or unknown cookie value".
- extend `apps/web/src/proxy.test.ts`: "forwards x-ad-locale-hint from the cookie", "?lang=yo sets the cookie and keeps the path", "the CSP and request id headers are unchanged".
- `apps/web/src/lib/i18n/layout-lang.test.tsx`: "html lang follows the resolved locale".
- extend profile data tests: "saving an unsupported language is a field error".
Config keys: `content.ui_languages`, `i18n.publish_min_percent` (registry).

### Slice 5. Language picker (viewer) and player wiring
Files: new `packages/ui/src/components/LanguagePicker.tsx` (+ css in `components.css`), `apps/web/src/components/i18n/LanguagePickerHost.tsx`, `apps/web/src/app/actions-language.ts` (`setLanguageAction`); edit header and footer components that exist (confirm exact files at build: the viewer shell under `apps/web/src/components` and `app/(viewer)`), `components/profiles/ProfileForm.tsx` (options from `LOCALES` filtered by enabled), `components/account/PlaybackSettings.tsx` (caption language row), `packages/player/src/types.ts`, `controller.ts`, `ui/PlayerView.tsx` (`t` prop).
Tests first
- `packages/ui/src/components/LanguagePicker.test.tsx`: "lists enabled locales by endonym with the English name beneath", "marks the current language with aria-checked", "each row sets lang to its own code", "arrow keys move and Enter selects", "Escape closes and returns focus", "hidden when only one locale is enabled", "rows are at least 44px tall", "shows the still in English hint below 100 percent".
- `apps/web/src/app/actions-language.test.ts`: "a guest choice sets the cookie only", "a signed in choice also updates the profile", "an unsupported code is rejected", "a kids profile cannot change language here".
- `apps/web/src/components/profiles/ProfileForm.test.tsx` additions: "language options follow the enabled list".
- `packages/player/src/ui/PlayerView.test.tsx` additions: "the player renders strings from the t prop".
Config: none.

### Slice 6. Fonts and diacritics
Files: new `apps/web/src/fonts/{inter,dm-sans,nunito,lora,space-grotesk}-vietnamese-wght-normal.woff2` (OFL texts already present), `apps/web/src/lib/fonts-coverage.test.ts`; edit `apps/web/src/lib/fonts.ts`, `packages/theme/src/css.ts` (stacks end with Inter), `packages/ui/src/tokens.css` (`--leading-marks`, `:lang()` rules), `packages/player/src/player.css`, `docs/DESIGN-SYSTEM.md` (5.1 correction, 5.3 rule, 14 Pidgin line, new 11.27), `package.json` (devDependency `fontkit`).
Tests first
- `apps/web/src/lib/fonts-coverage.test.ts`: "every family covers ẹ ọ ị ụ ṣ ṅ either itself or through Inter", "combining grave, acute, macron and dot below are covered by the stack", "the naira sign is covered", "every code point in the pseudo locale is covered", "every code point in each locale JSON (NFC) is covered".
- `packages/ui/src/tokens.test.ts` (or the existing token test): "yo and ig headings use --leading-marks", "micro labels have no letter spacing under yo and ig".
- `packages/player/src/captions-css.test.ts`: "cue font stack ends with Inter".
- `packages/theme/src/css.test.ts`: "Poppins stack names Inter as the per glyph fallback".
Config: none.

### Slice 7. Copy extraction waves (viewer only)
Method per wave: list the files, move literals to `en-ng.ts` with unchanged text, use `msg`/`useT`, add the files to the D-158 list in `eslint.config.js` in the same PR, extend `messages-coverage.test.ts`. Estimate: at least 415 literals today, plausibly 800 to 1,200 once strings built from parts and server error messages are counted (inferred).
- Wave A shell: header, nav, footer, home rows and titles, cards, hero, skeleton and empty states, offline and error pages, 404.
- Wave B discovery: browse, search, title page, series page, my list, continue watching, badges.
- Wave C account: auth pages and forms, profile picker and form, account, security, data, deletion, settings hub, notice texts. Service error messages are mapped from error codes at the web boundary; packages keep English text as a fallback and technical message.
- Wave D player: remaining controller and menu strings (including `CaptionRows` "Off" and `MenuRow` labels), settings menu, keyboard help.
- Wave E (Should): mailer templates take `locale` (see S17).
Tests per wave: a file level test per component that the rendered text equals `msg(key)`, and "renders in pseudo locale without a missing key" in `apps/web/src/lib/i18n/pseudo-render.test.tsx` that renders each wave's pages with the pseudo locale and asserts no raw key and no English left over (compare against English text set).
Admin screens are excluded by decision L7-D5, and the lint list never includes `components/admin`.

### Slice 8. Translation service and status (package `@ad/i18n`)
Files: new `packages/i18n/{package.json,tsconfig.json,vitest.config.ts,src/index.ts,src/service.ts,src/status.ts,src/store.ts,src/cache.ts}`; wire into `apps/web/src/lib/i18n/server.ts` (effective catalog with a version number from the settings cache, invalidated on approve and publish).
Tests first (`packages/i18n/src/*.int.test.ts` and unit)
- `status.test.ts`: "approved percent counts core keys only", "stale keys are those whose source_hash differs from the English hash", "missing keys exclude approved and draft", "plural keys need every category to count as approved".
- `service.int.test.ts`: "save creates a draft with the English hash", "an Editor can save but not approve", "approve needs Admin and records reviewer and time", "approving a row with a validation error is refused", "bulk approve reports count and skips rows with errors", "publish is refused below the threshold", "super admin override publishes below the threshold and is audited", "every write records an audit event".
- `cache.test.ts`: "a published change is visible on the next request after the version bump", "a draft never reaches viewers".
Permissions: add `i18n.edit`, `i18n.approve`, `i18n.publish` to the permission matrix (`apps/web/src/lib/admin/can.ts` and its test, `can-labels.ts`): Editor edit, Admin approve and publish, Super admin override, Analyst none.

### Slice 9. Export and import
Files: new `packages/i18n/src/{csv.ts,export.ts,import.ts}`; routes `apps/web/src/app/api/admin/languages/[locale]/export/route.ts` and `.../import/route.ts`.
Tests first
- `csv.test.ts`: "writes a UTF-8 BOM", "reads with and without a BOM", "keeps ọ́ and ẹ̀ unchanged through a round trip", "handles commas, quotes and newlines", "normalises decomposed input to NFC".
- `import.test.ts`: "dry run reports added, changed, unchanged and rejected without writing", "rejected rows carry a reason per row", "imported rows become in_review, never approved", "unknown keys are rejected", "more than 5,000 rows or 2 MB is refused", "a row that only changes whitespace is unchanged", "import is one transaction".
- `export.test.ts`: "export contains every English key with status", "export of an empty locale has blank translations", "JSON export is the effective catalog ready to commit".
- `apps/web/src/app/api/admin/languages/import.route.test.ts`: "Editors can import drafts", "Analysts get 403", "CSRF and size limits as other admin uploads".

### Slice 10. Admin screens: Languages and workspace
Files: new `apps/web/src/app/admin/(shell)/languages/page.tsx`, `loading.tsx`, `[locale]/page.tsx`, `actions.ts`; components `apps/web/src/components/admin/languages/{LanguageTable.tsx,Workspace.tsx,TranslationRow.tsx,ImportDialog.tsx,PublishSwitch.tsx}`; `apps/web/src/lib/data/admin/real/languages.ts` plus `languages.fixture.ts` behind the dev flag; admin nav entry and `docs/SCREEN-ARCHITECTURE.md` screens 140 to 144.
Tests first
- `LanguageTable.test.tsx`: "shows one row per locale with state, percent, missing and stale", "Publish is disabled below the threshold with the reason", "empty state when only English is enabled", "status uses an icon and a word, not colour alone", "table cells align (Cues style defect from the owner punch list does not recur)".
- `Workspace.test.tsx`: "filters Missing, Stale, In review and Approved", "typing marks the row dirty and Save is enabled", "validation errors appear under the field with aria-describedby", "Copy English fills the field", "plural rows show only the locale's categories", "bulk approve shows the count and a warning when rows have warnings", "keyboard: Tab order follows the visual order, Escape closes dialogs".
- `ImportDialog.test.tsx`: "shows the dry run table before confirming", "file too large shows the limit", "network failure keeps the chosen file".
- `apps/web/src/lib/data/admin/real/languages.int.test.ts`: real data path reads and writes.

### Slice 11. Missing key sink and report
Files: new `packages/i18n/src/missing.ts`, `apps/web/src/lib/i18n/missing-sink.ts`, report tab in the workspace.
Tests first
- `missing.test.ts`: "hits are batched and flushed once a minute per process", "a sink failure never breaks rendering", "only enabled non default locales are recorded", "bots and prefetch requests are not counted", "the table is capped at 10,000 keys per locale".
- `missing.int.test.ts`: "flush increments hits and updates last_seen".
- component test: "report sorts by hits and links each key to the workspace row".

### Slice 12. Translation providers and the sidecar
Files: new `packages/video/src/captions/translate/{types.ts,nllb.ts,google.ts,llm.ts,fake.ts,glossary.ts,batch.ts,index.ts}`, `apps/worker/src/translator.ts` (`chooseTranslator(env)`, mirrors `transcriber.ts`); new app `apps/translate/{server.py,translator.py,requirements.txt,Dockerfile,test_server.py,test_translator.py,package.json,vitest.config.ts}`; edit `docker-compose.yml` (service `translate`, profile `translate`, volume `translate-models`), `packages/config/src/env.ts`, `docs/DEPLOYMENT.md`, `docs/CLIENT-INPUTS.md`.
Sidecar contract: `POST /translate` JSON `{source, target, texts[]}` returns `{texts[], model}`; `GET /health`; one request at a time, 429 with Retry-After while busy; no storage credentials; private network only; max body 256 KB; same hardening as `apps/whisper/server.py`.
Tests first
- `apps/translate/test_server.py`: "rejects an unknown language code", "429 while busy", "413 over the body limit", "returns texts in the same order and count", "health reports the model".
- `packages/video/src/captions/translate/batch.test.ts`: "splits cues into batches of about 20", "restores order", "falls back to cue by cue when the line count differs", "never merges text across cue boundaries".
- `glossary.test.ts`: "protected terms survive translation unchanged", "terms match whole words only".
- `nllb.test.ts`, `google.test.ts`, `llm.test.ts`: "maps our codes to the provider codes (yo to yor_Latn, ig to ibo_Latn, ha to hau_Latn)", "a provider error becomes a retryable PipelineError", "an unsupported pair is a permanent error with a plain message", "the API key is sent as a header and never logged".
- `apps/worker/src/translator.test.ts`: "provider none is a permanent not configured error", "fake is chosen under TRANSLATE_FAKE", "nllb needs TRANSLATE_URL".
- `packages/config/src/env.test.ts`: "google needs TRANSLATE_API_KEY", "TRANSLATE_FAKE is rejected in production", "a cap of 0 disables API providers".
- usage: "a job that would cross TRANSLATE_MONTHLY_CHAR_CAP is refused before any call".

### Slice 13. Caption translate job and service
Files: edit `packages/queue/src/definitions.ts` (queue `caption.translate`: concurrency 1, retryLimit 2, retryDelaySeconds 120, retryBackoff true, expireInSeconds 30 * 60, heartbeatSeconds 300; payload `{ videoId, targetLanguage, sourceCaptionId?, mode }`), `packages/queue/src/definitions.test.ts`; new `packages/video/src/captions/translator-job.ts`, `apps/worker/src/translate-handlers.ts` (one registration line added to `handlers.ts`); edit `packages/video/src/captions/service.ts` (`requestTranslation`, `estimateTranslation`, `translationState`), `revisions.ts` (`ensureTrack` takes a label from `LOCALES`, `published` argument).
Tests first
- `packages/video/src/captions/translator-job.int.test.ts`: "creates an in_review revision with source translation and published false", "copies cue timings unchanged", "reflows to 2 lines of 42 characters and keeps validation warnings", "records source_caption_id and source_sha256", "model records the engine", "no speech in the source gives a clear permanent error", "an unapproved source is refused", "a rerun adds a revision and keeps the approved one live until approved".
- `service.int.test.ts` additions: "requestTranslation is Editor and above", "refuses a language not in content.languages", "refuses a language the provider cannot do", "estimate returns characters and the provider's cost or CPU minutes", "translationState reports source changed when the source sha differs".
- `apps/worker/src/translate-handlers.test.ts`: "success notifies captionsReady for the language", "failure notifies captionsFailed once after retries".
- `packages/queue/src/definitions.test.ts`: "caption.translate payload requires a known language and rejects extra keys".

### Slice 14. Publish switch and the viewer track list
Files: edit `packages/video/src/captions/service.ts` (`setPublished`, `publicCaptions` filters on `published` and on `content.languages`), `apps/web/src/server/data/real-playback.ts` (pass the allowed list and the UI locale), `packages/player/src/controller.ts` (default track choice and fallback), `packages/player/src/ui/Menus.tsx` (`CaptionRows` labels with `lang`, catalog "Off"), `apps/web/src/lib/data/playback.fixture.ts`, `packages/catalog/src/detail.ts`, `titles.ts` (CC badge counts only published tracks).
Tests first
- `service.int.test.ts`: "publicCaptions omits approved but unpublished tracks", "publicCaptions omits a language removed from content.languages", "publicCaptions never lists draft, in_review or rejected tracks", "unpublishing takes effect on the next playback".
- `controller.test.ts`: "default track is the profile caption language when listed", "else the UI language when listed", "else English, never tracks[0]", "a track that fails to load falls back to English with the player.captions.fallback toast", "with one track there is a toggle and no menu".
- `Menus.test.tsx` (or `PlayerView.test.tsx`): "rows show the endonym and carry lang", "Off is first", "only listed languages appear".
- catalog tests: "CC badge ignores unpublished translation tracks".

### Slice 15. Admin caption screens with languages
Files: edit `packages/catalog/src/admin/captions.ts` (rows per video with a language summary: spoken language state plus chips for translations), `apps/web/src/components/admin/CaptionList.tsx` (language chips column, language filter, bulk approve with count and warning), `CaptionReview.tsx` (tabs, English side column, timing lock, publish switch), `apps/web/src/lib/data/admin/real/captions.ts` and `caption-commands.ts` (language parameter replaces the six `'en'` literals), routes `apps/web/src/app/api/admin/videos/[id]/captions/route.ts` and `.../captions/[id]/approve/route.ts` (accept language), new `apps/web/src/components/admin/AddTranslationDialog.tsx`, `TranslationPublishSwitch.tsx`; `apps/web/src/app/admin/(shell)/captions/[videoId]/page.tsx` reads `?lang=`.
Tests first
- `packages/catalog/src/admin/captions.int.test.ts`: "rows carry a chip per translation with its state", "Source changed is reported", "state filter works per language".
- `CaptionList.test.tsx`: "language chips use an icon and a word", "Cues column stays right aligned with the new column", "bulk approve shows the count and warns about warnings".
- `CaptionReview.test.tsx`: "language tabs switch tracks and keep unsaved edits warned", "translation mode shows the English cue beside each cue", "time fields are locked until Unlock timing", "approve says viewers will not see it until published", "Publish switch is disabled until approved".
- `AddTranslationDialog.test.tsx`: "shows only supported languages", "shows the estimate", "provider not configured shows a plain message and no Start button", "focus is trapped and returns to the trigger".
- `apps/web/src/lib/data/admin/real/captions.int.test.ts`: "language parameter reaches the service", "an editor cannot publish".

### Slice 16. Whisper multilingual and language detection
Files: edit `apps/whisper/server.py` (accept `auto`, return `language_probability`, route `en` to the English model and others to `WHISPER_MODEL_MULTI`), `apps/whisper/transcriber.py`, `packages/video/src/captions/generator.ts` (real language, detection handling, language map `pcm` to `en`), `packages/video/src/captions/adapter.ts` (`HttpWhisperClient` passes language and reads probability), `packages/catalog/src/admin/videos.ts` and the video details form (spoken language select), `docker-compose.yml` and `apps/whisper/Dockerfile` (`WHISPER_MODEL_MULTI`), `packages/config/src/env.ts` deploy list, `CaptionService.hasApprovedCaptions` caller in the publish gate (`packages/catalog/src/publishing.ts`).
Tests first
- `apps/whisper/test_server.py`: "auto omits the language argument", "response carries language_probability", "non English routes to the multilingual model", "unset multilingual model returns 422 with a plain error for non English", "invalid language code still 400".
- `apps/whisper/test_requirements.py` additions if the pinned versions change.
- `packages/video/src/captions/generator.int.test.ts`: "passes the video language to the transcriber (regression for the hardcoded en)", "pcm is decoded as en", "auto above 0.6 updates videos.language and notes Detected", "auto below 0.6 notes Spoken language uncertain", "ig generation is refused with the upload hint", "multilingual not configured gives the English only message".
- `packages/catalog/src/publishing.int.test.ts`: "gate checks the spoken language track", "an English video still needs English".
- `packages/catalog/src/admin/videos.int.test.ts`: "spoken language saves and rejects unknown codes".

### Slice 17. Emails and offline page (Should and Could)
Files: edit `packages/mailer/src/templates.ts` (`renderTemplate` takes `locale`, strings from catalog namespace `mail`), `apps/web/src/app/offline/*` (inline table for all enabled locales, picked from `localStorage` key `ad:locale`), `apps/web/src/lib/pwa/sw-source.ts` (precache stays one page).
Tests first: `templates.test.ts`: "mail renders in the account locale and falls back to en per key", "subject lines carry no em or en dash"; offline test: "offline page shows the stored locale and falls back to English".

### Slice 18. Docs, stories and lane notes
Edit `docs/USER-STORIES.md` (section 8 edits, new M46 section), `docs/MODULES.md` (M46 entry and the M11, M15, M34 lines), `docs/SCREEN-ARCHITECTURE.md` (screens 140 to 149), `docs/PRD.md` (phase 2 note only), `docs/CLIENT-INPUTS.md` (languages, reviewers, engine), `docs/DEPLOYMENT.md` (translate profile, multilingual whisper, NDPA cookie), `docs/SECURITY.md` (new permissions, new routes, API key handling), `docs/DATA-MODEL.md`, `docs/lanes/L7.md`. `ai-context.md` is updated by the main session, not this lane.

## 6. Migrations, jobs and config keys at a glance

| Item | Name |
|---|---|
| Migration | `00NN_i18n_and_caption_languages.sql` (additive) |
| Tables | `ui_translations`, `ui_missing_keys`, `translation_usage` |
| Columns | `caption_tracks.published`, `captions.source_caption_id`, `captions.source_sha256` |
| Enum | `ui_translation_status` |
| Queue | `caption.translate` (existing `caption.generate` unchanged) |
| Cookie | `ad_locale` |
| Query | `?lang=` |
| Env | `TRANSLATE_PROVIDER`, `TRANSLATE_URL`, `TRANSLATE_API_KEY`, `TRANSLATE_PCM_PROVIDER`, `TRANSLATE_MODEL`, `TRANSLATE_COMPUTE_TYPE`, `TRANSLATE_MAX_CHARS_PER_JOB`, `TRANSLATE_MONTHLY_CHAR_CAP`, `TRANSLATE_FAKE`, `WHISPER_MODEL_MULTI`, `DEV_PSEUDO_LOCALE` |
| Admin settings | `content.ui_languages`, `content.languages` (exists), `i18n.publish_min_percent`, `translation.glossary`, `captions.translation_publish_default` |
| Permissions | `i18n.edit`, `i18n.approve`, `i18n.publish`, `captions.translate`, `captions.publish_language` |
| Audit actions | `i18n.translation.save`, `.approve`, `.import`, `.publish_locale`, `.override_threshold`, `caption.translate.request`, `caption.language.publish`, `caption.language.unpublish` |
| Compose | service `translate` (profile `translate`), volume `translate-models` |
| Routes | `/admin/languages`, `/admin/languages/[locale]`, `/api/admin/languages/[locale]/export`, `.../import`, caption routes gain a language parameter |

## 7. Stories

### 7.1 Exact edits to existing stories

Apply these to `docs/USER-STORIES.md`. Each shows the line to replace and the replacement.

1. M08-S12 AC2. Replace "Given the menu has languages (phase 2), When I choose one, Then the track switches immediately." with "Given the menu lists approved languages (M46-S14), When I choose one, Then the track switches immediately and my choice is remembered for this profile."
2. M03-S09 AC2. Replace "Given I change the caption language (phase 2), When I save, Then it applies to this profile only." with "Given I change the interface or caption language in the profile form, When I save, Then it applies to this profile only (M46-S01)." Add Edge: "the interface language and the caption language are separate settings; the caption language defaults to the interface language until changed."
3. M11-S01. Add "AC4: Given a track is approved but its Publish switch is off, or its language is removed from the site's caption languages, When the player loads, Then the track is not attached and not listed."
4. M11-S04. Replace the whole story with:
   "### M11-S04 Caption language menu (Should)
   As a viewer, I want to choose among caption languages, so that I read in my language.
   - AC1: Given several approved and published tracks, When I open the menu, Then each language shows by its own name (Yorùbá, Igbo, Hausa, Naijá, English) with Off first.
   - AC2: Given my profile caption language has a track, When the video loads, Then that track is chosen. Else the interface language if it has one, else English. Never the first track by position.
   - AC3: Given a language track fails to load, When it fails, Then English is used and a toast says "That language could not load. Showing English."
   - Edge: only approved and published tracks are listed; with only English there is a toggle and no menu; each row carries its own `lang` attribute.
   - Error: no track at all hides the CC button.
   - Empty: not applicable."
5. M15-S01. Retitle "Auto generate captions in the spoken language (Must)". AC1: replace "creates a WebVTT track in English" with "creates a WebVTT track in the video's spoken language (English, Yoruba or Hausa on a server with the multilingual model, M46-S15)". Add AC4: "Given the spoken language is Igbo, When I open Captions, Then generation is not offered and the page says to upload a caption file."
6. M15-S03 AC1. Append: "A language chip per translation shows its state, and the list filters by language and by state."
7. M15-S10 AC1. Replace "without an approved English track" with "without an approved track in its spoken language". Edge: "Translations never block publishing."
8. M15-S11. Replace the whole story with: "### M15-S11 Caption translations (superseded)" followed by one line "Moved and expanded as M46-S11 to M46-S13 and M46-S16."
9. M26-S05 AC2. Replace "English is the only option with a note 'More languages are coming'" with "Given language, When shown, Then the enabled languages are listed by their own names with the current one selected (M46-S01), and with only English enabled the row is hidden."
10. M29-S01. Replace "and default language" with "default language, interface languages and caption languages (M46-S06)".
11. M34-S04. AC1: append "Locales are en, yo, ig, ha and pcm; English is the source." Replace AC1's "locale `en-NG`" with "the locale's Intl data with fallback to `en-NG`". Edge: replace "dates and durations use locale formatting ("6 min")" with "dates and durations come from the catalog and Intl ("6 min" in English)". Error: replace with "a missing key falls back to English for that key only, and the key is recorded in the missing key report (M46-S10)."
12. `docs/MODULES.md`: M11 "language choice (English at launch)" becomes "language choice among approved published languages". M34 "English at launch" stays; add "and locale aware formatting for en, yo, ig, ha, pcm (M46)". Add a module entry M46 and the dependency line "M46 depends on M11, M15, M29, M34, M30, M12".

### 7.2 New stories, module M46 Languages

Personas: Viewer (Tobi), Diaspora viewer (Chidinma), Kid (Kemi), Parent, Admin (Sister Vanessa), Super admin (ARKDEV). Translator volunteer works through Sister Vanessa and exported files.

## M46 Languages

### M46-S01 Choose my language (Must)
As a viewer, I want to switch the interface to Yoruba, Igbo, Hausa or Pidgin without signing in, so that I can understand the site.
- AC1: Given more than one language is enabled, When I open the language control, Then I see each language by its own name with the English name beneath, and the current one is marked.
- AC2: Given I am a guest, When I choose Yorùbá, Then the page re-renders in Yorùbá without a full reload and the choice is kept in the `ad_locale` cookie.
- AC3: Given I am signed in with a profile, When I choose a language, Then it is saved on that profile and the cookie is also set.
- AC4: Given only English is enabled, When I look for the control, Then it is not shown.
- AC5: Given a screen reader, When the language changes, Then a polite announcement says "Language changed to Yorùbá" in the new language, and `<html lang>` updates.
- Edge: a kids profile does not show the control; the parent sets the language in the profile form. `?lang=yo` in a link sets the language for the visitor.
- Error: save failure keeps the cookie choice and shows "We could not save your language. It will apply on this device."
- Empty: not applicable.

### M46-S02 My language is remembered and guessed sensibly (Must)
As a viewer, I want the site to start in my language, so that I do not hunt for the switch.
- AC1: Given I have no cookie and my browser prefers `yo-NG` and Yoruba is enabled, When I open the site, Then it renders in Yoruba with no prompt.
- AC2: Given order of precedence, When several apply, Then query, then profile, then account, then cookie, then browser language, then the site default decide.
- AC3: Given a locale that is not enabled, When it would otherwise win, Then it is skipped.
- AC4: Given I sign out on a shared device, When the next person opens the site, Then the cookie language applies, not my profile.
- Edge: invalid cookie values and unknown `lang` values are ignored.
- Error: not applicable.
- Empty: not applicable.

### M46-S03 Missing translations show in English (Must)
As a viewer, I want a half translated language to stay usable, so that I am never shown a blank or a raw key.
- AC1: Given a key has no approved translation, When the screen renders, Then that string shows in English and the rest stays in my language.
- AC2: Given a key is missing everywhere, When rendered, Then the key itself is never shown to viewers (English text exists for every key by the coverage test).
- AC3: Given a language is below 100 percent, When I open the picker, Then a line says "Some text is still in English."
- Edge: a stale translation (English changed later) still shows until reviewed.
- Error: a failure to load the catalog shows English for the page.
- Empty: not applicable.

### M46-S04 Letters and tone marks display correctly (Must)
As a Yoruba or Igbo reader, I want ẹ ọ ị ụ ṣ ṅ and tone marks to draw properly in every font the admin can pick, so that words are not wrong or ugly.
- AC1: Given any of the six theme fonts, When Yoruba or Igbo text shows, Then every character comes from the chosen family or from Inter, never a random system font.
- AC2: Given English pages, When they load, Then no extra font file is downloaded.
- AC3: Given stacked marks (a dot below with a tone mark above) in headings, When rendered at the hero size, Then nothing is clipped.
- AC4: Given captions in Yoruba, When shown in the player, Then marks render with the same rule.
- Edge: text is stored and compared as NFC; decomposed input is normalised.
- Error: a font file that fails to load falls back per glyph to Inter, then the system font.
- Empty: not applicable.

### M46-S05 Numbers, dates, durations and plurals follow my language (Should)
As a viewer, I want "6 min", "17 Nov 2026" and "1 video" style text to read naturally, so that nothing looks half translated.
- AC1: Given a language, When a count shows, Then the plural form follows that language's rules (Yoruba and Igbo use one form for all counts).
- AC2: Given a duration, When shown, Then the words for minute and hour come from the catalog ("6 min" in English).
- AC3: Given a date, When shown, Then month names come from the locale when its data exists, else English, in the pattern "17 Nov 2026".
- AC4: Given the naira sign, When shown, Then it is the real ₦ with thousands separators.
- Edge: "Today" and "Yesterday" come from the catalog.
- Error: an engine without locale data falls back to `en-NG` formatting.
- Empty: not applicable.

### M46-S06 See and publish interface languages (Must)
As an admin, I want one screen to see how complete each language is and turn it on, so that I only publish what is ready.
- AC1: Given `/admin/languages`, When it loads, Then I see one row per language with state (Off, Draft, Live), approved percent, missing, stale, in review and last change.
- AC2: Given a language is below the publish threshold (default 80 percent of core keys), When I try to switch it Live, Then the switch is disabled with "Needs 80 percent of core text approved. Now 42 percent."
- AC3: Given a Super admin, When they override the threshold with a reason, Then the language goes Live and the override is audited.
- AC4: Given I switch a language Off, When viewers load a page, Then it renders in the fallback language and saved choices for that language are treated as unset.
- Edge: English cannot be switched off.
- Error: load failure shows retry inside the table area.
- Empty: "Only English is set up. Choose a language to start translating."

### M46-S07 Translate in the workspace (Must)
As an admin or editor, I want to translate text side by side with the English, so that I can work quickly and safely.
- AC1: Given `/admin/languages/yo`, When it loads, Then each row shows key, English, an editable translation, status and placeholder chips, with filters Missing, Stale, In review, Approved and an area filter and search.
- AC2: Given I edit a row, When I save, Then it becomes a draft, validation runs (placeholders, plural forms, no dashes, plain text) and errors show under the field.
- AC3: Given a plural key, When I open it, Then only the forms that language uses are shown.
- AC4: Given an Admin, When I approve rows, Then they take effect for viewers on the next request; Editors can save but not approve.
- AC5: Given I select many rows, When I bulk approve, Then a confirmation shows the count and a warning about rows with warnings.
- Edge: Copy English is offered for names and brand words; the character count warns above 2.5 times the English.
- Error: save failure keeps my text and offers Retry.
- Empty: "Everything in this language is approved."

### M46-S08 Export and import translations (Must)
As an admin, I want to send a spreadsheet to a volunteer and import it back, so that people without accounts can help.
- AC1: Given a language, When I choose Export, Then I can download CSV (UTF-8 with a BOM so diacritics survive Excel) or JSON with key, area, English, translation, status and note.
- AC2: Given an edited file, When I import it, Then a dry run shows added, changed, unchanged and rejected rows with a reason per rejected row before I confirm.
- AC3: Given I confirm, When the import runs, Then rows become In review (never Approved) in one transaction and the import is audited.
- AC4: Given a file over 2 MB or 5,000 rows, When I choose it, Then it is refused with the limit stated.
- Edge: decomposed characters are normalised; blank translations are ignored.
- Error: a malformed file shows the first problem and changes nothing.
- Empty: not applicable.

### M46-S09 Translation status and stale text (Should)
As an admin, I want to know which translations need a second look after English changed, so that meaning does not drift.
- AC1: Given English text changed after it was translated, When I open the workspace, Then the row shows "Source changed" with the old and new English.
- AC2: Given a stale row, When I choose Still correct, Then the hash is updated and the badge clears; When I edit and approve, Then the same.
- AC3: Given viewers, When a row is stale, Then they keep seeing the existing approved translation.
- Edge: the Languages table shows the stale count.
- Error: not applicable.
- Empty: not applicable.

### M46-S10 Missing key report (Should)
As an admin, I want to see which English strings viewers actually met in my language, so that I translate the most seen text first.
- AC1: Given the Missing tab, When it loads, Then keys are listed by hits with last seen date and area.
- AC2: Given I tap a key, When opened, Then the workspace shows that row.
- AC3: Given a key is approved, When viewers next load it, Then it drops off the report.
- Edge: bots and prefetch are not counted; counts are batched, not per request.
- Error: a recording failure never affects the page.
- Empty: "No missing text has been seen yet."

### M46-S11 Add a machine translation of captions (Must)
As an admin, I want to create a draft translation of approved captions, so that reviewers start from a draft instead of a blank page.
- AC1: Given a video with an approved track in its spoken language, When I choose Add translation and pick a language, Then a dialog shows the estimate (characters and cost, or minutes on this server) and a Start button.
- AC2: Given I start, When the job runs, Then a draft track is created in that language with the same timings, `in_review`, Publish off, and a notification "Translation ready to review" appears.
- AC3: Given the provider is not configured or does not support the language, When I open the dialog, Then it says so in plain words and offers uploading a caption file instead.
- AC4: Given a monthly character cap is set for an API provider, When a job would cross it, Then it is refused before any text is sent.
- Edge: only Editors and above can start jobs; viewers can never trigger a translation; glossary terms (platform and program names) are kept unchanged.
- Error: a failed job shows Retry and the plain reason.
- Empty: not applicable.

### M46-S12 Review a translated track side by side (Must)
As a reviewer, I want to read the English cue next to the translated cue, so that I can correct meaning and fit.
- AC1: Given `/admin/captions/[videoId]?lang=yo`, When it loads, Then tabs list the video's languages, the video overlay shows the Yoruba cue, and each row shows the English cue beside the translated one.
- AC2: Given timing, When I open a translated track, Then time fields are locked until I choose Unlock timing, which warns that it differs from the source.
- AC3: Given edits, When I leave a tab with unsaved changes, Then I am warned; autosave, undo and find and replace work as in M15-S05 and S06.
- AC4: Given warnings (line too long, more than 2 lines), When I approve, Then I confirm them as in M15-S07.
- Edge: marks type correctly on a Yoruba keyboard and survive save.
- Error: save failure shows Retry as in M15-S05.
- Empty: a language with no track shows Add translation.

### M46-S13 Publish a caption language (Must)
As an admin, I want to decide when a language goes live, so that nothing unreviewed reaches viewers.
- AC1: Given an approved translated track, When I switch Publish on for this video and language, Then viewers can pick it from the next playback.
- AC2: Given an unapproved track, When I look at the switch, Then it is disabled with "Approve this track first."
- AC3: Given Captions settings, When I switch a language off for the whole site, Then it disappears from every player at once, and switching it on restores the published tracks.
- AC4: Given "Source changed" on a track, When I look at the list, Then I can Retranslate or choose Still correct; viewers keep the approved track meanwhile.
- Edge: every change is audited with the actor.
- Error: save failure restores the switch and shows Retry.
- Empty: not applicable.

### M46-S14 The player lists only approved languages (Must)
As a viewer, I want the caption menu to show only languages I can trust, so that I do not read a draft.
- AC1: Given a video with English approved and Yoruba approved and published, When I open the caption menu, Then I see Off, English and Yorùbá, by their own names.
- AC2: Given Hausa is a draft or unpublished, When I open the menu, Then Hausa is absent.
- AC3: Given my profile caption language is Yoruba and the track exists, When I start the video, Then Yoruba is chosen; otherwise the interface language; otherwise English.
- AC4: Given the Yoruba file fails to load, When playback continues, Then English captions are used with the toast "That language could not load. Showing English."
- Edge: the title page CC badge counts only published tracks.
- Error: as AC4.
- Empty: a video with no published tracks has no CC button.

### M46-S15 Spoken language and detection (Must)
As an admin, I want to say what language a video is spoken in, so that captions come out in that language.
- AC1: Given the video details form, When I choose Spoken language (English, Yoruba, Hausa, Pidgin, Igbo, Auto), Then it is saved and used by the caption job.
- AC2: Given Auto, When the job runs, Then the detected language and confidence are noted; at or above 0.6 the video is updated, below it the review note says "Spoken language uncertain, check the captions".
- AC3: Given Yoruba or Hausa on a server without the multilingual model, When I generate, Then I see "This server only recognises English. Upload a caption file or align a script." and no English transcription is made.
- AC4: Given Igbo, When I open Captions, Then generation is not offered and Upload is.
- AC5: Given Pidgin, When generation runs, Then it is decoded as English and the review note says so.
- Edge: the publish gate checks the spoken language track.
- Error: a failed job shows Retry as in M15-S01.
- Empty: not applicable.

### M46-S16 Translate and approve in bulk (Should)
As an admin, I want to translate a whole library into one language, so that I do not click each video.
- AC1: Given Captions list, When I choose "Translate approved videos into Hausa", Then a dialog shows how many videos, characters, cost or time, and I confirm.
- AC2: Given the jobs, When they run, Then they run one at a time and the list shows progress per video.
- AC3: Given reviewed translations, When I select several and bulk approve, Then a dialog shows the count and a warning about rows with warnings.
- AC4: Given many approved tracks, When I choose Publish on for selected, Then they are published in one action and audited once per track.
- Edge: videos without an approved source are skipped with a count.
- Error: partial failure shows which failed and a Retry for those.
- Empty: "No videos are ready to translate."

### M46-S17 Translation engine and cost guard (Should)
As the super admin, I want to see which translation engine is configured and how much has been used, so that costs stay in check.
- AC1: Given `/admin/languages`, When I open Engine, Then I see provider name, state (Configured, Not configured), supported languages and this month's characters against the cap. The key itself is never shown.
- AC2: Given an API provider and a cap, When usage reaches 80 percent, Then a notice appears; at 100 percent new jobs are refused.
- AC3: Given the self hosted engine, When the sidecar is unreachable, Then the page says so and jobs wait for retry.
- Edge: Pidgin shows "Written by people. No engine drafts this language" unless the LLM option is configured.
- Error: usage cannot load shows retry.
- Empty: provider none shows "Machine translation is off. You can still upload translated caption files."

### M46-S18 Emails and the offline page in my language (Could)
As a viewer, I want the offline page and account emails in my language, so that important messages are understood.
- AC1: Given I am offline, When the offline page shows, Then it uses my stored language and falls back to English.
- AC2: Given an account email, When sent, Then it uses my account language and falls back to English per key.
- Edge: subjects follow the same copy rules and carry no dashes.
- Error: not applicable.
- Empty: not applicable.

### M46-S19 Pseudo language for layout checks (Could)
As a developer, I want a pseudo language that lengthens text and uses the hard letters, so that I can check layout and fonts without a translator.
- AC1: Given `DEV_PSEUDO_LOCALE` is on, When I pick the pseudo language, Then every string is about 40 percent longer with ẹ ọ ṣ ị ụ and tone marks, placeholders intact.
- AC2: Given production, When the flag is set, Then startup refuses it.
- Edge: the font coverage test uses the pseudo output.
- Error: not applicable.
- Empty: not applicable.

Counts: 19 new stories in M46 (Must: S01, S02, S03, S04, S06, S07, S08, S11, S12, S13, S14, S15; Should: S05, S09, S10, S16, S17; Could: S18, S19) plus 12 edits to existing stories and docs.

## 8. UI review against the audit and the design skill

Run before building, on the planned screens (the skill is then run again on the built screens before each PR, as CLAUDE.md requires).

Audit alignment
- Guests first class (audit 5): the picker has no sign in dependency; the guest header must not gain a fifth control on a 360 px phone. Below 600 px the picker sits in the account or guest menu, the settings hub row and the footer; a globe icon button appears from 600 px. No first visit language modal or banner (no walls, no prompts). A browser language match just renders in that language.
- Owner punch list: item 2 and 3 (table alignment, breadcrumbs) apply to the Languages table and the caption list with its new language column; item 4 bulk approve is one shared component for strings and for captions; item 5 captions on and off resolves into the per language Publish switch plus the site wide language switch.
- Audit "unchecked: fonts bundle for all six families" is now answered with data (section 3), and is a Blocker for Yoruba and Igbo release.
- Audit note on `.ad-tile:focus-visible`: not touched, but the picker rows and the caption rows must have their own focus ring tokens.
- Hover only rules wrapped in `@media (hover: hover)`; the picker works by tap and keyboard first.

Design skill checklist (Pass means planned, to be proven on the build)
- Tokens only: Pass, with one new token `--leading-marks` documented in `tokens.css`, section 3 and the theme editor group (Fixed). Status chips reuse existing badge tokens.
- Fonts: Fail today (missing glyphs), fixed by slice 6; no font outside the curated list; vietnamese subsets are the same families and licence.
- Contrast: Pass planned; state chips use icon plus word, never colour alone; compute ratios for the Stale and In review chips on the admin surface.
- States: picker (default, hover, focus, active, current, disabled when saving, error), workspace row (clean, dirty, saving, error, stale, approved), table (loading skeleton at final geometry, empty, error). Admin skeletons appear after 300 ms.
- Keyboard and focus: picker is a `radiogroup`; the mobile sheet and desktop menu trap focus, return it to the trigger, close on Escape; touch rows 44 px.
- Motion: sheet slide uses transform and opacity at token durations and is instant under reduced motion; language switch re-render does not animate.
- Copy rules: sentence case, no em or en dashes, no emojis in any catalog, enforced by the validator on save and import. Section 14 says "No Pidgin in the UI in v1"; that line is edited to "Pidgin appears only in the `pcm` catalog and is reviewed by a native speaker before it is switched Live." Language names are endonyms with English beneath so a person who cannot read English can still find their language.
- Mobile first and data: catalogs resolved on the server, shell namespace budget 15 KB gzipped, vietnamese font files fetched only on pages that need them.
- Text expansion: all new and extracted components are checked in the pseudo locale at 360 px and at 200 percent zoom. Fixed width buttons are a Major finding.
- Caption language screens: tabs follow DESIGN-SYSTEM 11.15, the Publish switch follows 11.2, dialogs follow 11.12, tables 11.16. The estimate and cost line is plain words ("About 9,000 characters. About 2 minutes on this server.") and never a bare code.
- Known risk to keep visible: `CaptionRows` hardcodes "Off" and passes labels straight through; the labels must be rendered with a `lang` attribute or screen readers will mispronounce them.

## 9. Mockup list (S140 to S149)

Each mockup is a `.dc.html` in `/home/claude/ad/project/` following the existing S4x files (mobile `_m` variants, tokens from the shared sheet, real Yoruba, Igbo, Hausa and Pidgin sample strings that include ẹ ọ ṣ ị ụ and tone marks).

| No | File name | Content | States to show |
|---|---|---|---|
| S140 | `S140_language_picker_m` | Mobile bottom sheet from the account menu and from the footer, guest and signed in headers, and a Yoruba home header at hero size to prove marks are not clipped | closed, open, current marked, saving, save error toast, only English (control hidden), Some text is still in English hint, 360 px and 200 percent zoom |
| S141 | `S141_language_picker` | Desktop globe button and menu, footer link, kids profile (no control) | default, hover, focus, open, current, keyboard navigation, Yoruba and Igbo rendering in two theme fonts |
| S142 | `S142_language_settings` | Settings hub language row and profile form language and caption language selects, mobile and desktop | default, saving, error, disabled for kids profile, caption language defaults to interface language |
| S143 | `S143_admin_languages` | Languages table (desktop) and cards (mobile), Engine tab | loading skeleton, Draft and Live, below threshold with reason, Super admin override dialog, empty (only English), error with retry, Engine configured, not configured, usage near cap |
| S144 | `S144_admin_translate_workspace` | Side by side workspace with filters, plural row, placeholders as chips, bulk approve bar; mobile stacked rows | missing, stale with old and new English, in review, approved, validation errors (placeholder, dash, length), dirty, saving, saved, bulk approve confirm with warning count |
| S145 | `S145_admin_import_export` | Export menu, import dialog with dry run table, mobile | choose file, dry run with rejected reasons, confirm, success, file too large, malformed file, network failure |
| S146 | `S146_admin_missing_keys` | Missing key report tab, desktop and mobile | with data sorted by hits, empty, loading, error |
| S147 | `S147_caption_list_languages` | Captions list with language chips, language and state filters, bulk approve and bulk publish confirm, bulk translate dialog; mobile cards | none, generating, needs review, approved, published, unpublished, Source changed, failed, partial failure summary, empty |
| S148 | `S148_caption_review_translation` | Review screen in translation mode: language tabs, English cue beside translated cue, timing lock, Publish switch, Add translation dialog with estimate; mobile with sticky video | draft, locked timing, unlocked warning, warnings on approve, approved and unpublished, published, provider not configured, unsaved tab change warning, saving error |
| S149 | `S149_player_caption_languages_m` | Player caption menu on mobile portrait, mobile landscape and desktop with English, Yorùbá, Hausa, Naijá | Off, one language (toggle only), several, long labels, default chosen by profile language, track failed with English fallback toast, reduced motion |

## 10. Dependencies

- Hard: `@ad/shared` messages (D-153, D-158), caption pipeline (M11, M15), settings registry (M29), job queue (M30), admin shell and permissions (M12), profile and account language fields (M03, M02).
- With other v2 lanes: the guest access lane (audit section 5) owns `ad_guest` and the viewer-or-guest helpers; this lane reads the viewer through the same helper and must not add its own session logic. Any lane adding user facing copy after slice 7 starts must use `msg` and add its file to the lint list (state this in `docs/lanes/L7.md`, otherwise extraction waves chase a moving target). The SEO work (sitemap, robots, JSON-LD) decides whether a prefix is ever needed; hreflang is a follow up there.
- Infra: multilingual whisper and the translate sidecar need RAM headroom (section 4.6). Both are optional and off by default.
- External: native speaker reviewers per language (CLIENT-INPUTS).

## 11. Decisions to log (recommended option, reversible unless noted)

Placeholders L7-D1 to L7-D17, take the next free D-numbers when logging.

| Id | Decision | Options | Why | Reversible |
|---|---|---|---|---|
| L7-D1 | Locales are `en`, `yo`, `ig`, `ha`, `pcm`, short codes in storage, enabled per site by `content.ui_languages` | BCP47 tags in storage, one setting for UI and captions | Matches existing columns; two settings because caption languages and UI languages complete at different times | Yes |
| L7-D2 | No locale URL prefix; `?lang=` sets the cookie | Path prefix, subdomain | Guests need no account, no SEO or hreflang yet, prefix touches every route and the service worker | Yes |
| L7-D3 | Resolution: query, profile, account, cookie, Accept-Language, site default | Cookie first | A signed in profile is the most deliberate choice; cookie covers guests and shared devices | Yes |
| L7-D4 | Catalogs: repo JSON baseline plus DB drafts and approvals, merged at read, exported for commit | Files only (volunteers need deploys), DB only (no git history, no offline build) | Lets Sister Vanessa work without a deploy and keeps git as the record | Yes |
| L7-D5 | Admin UI, legal page bodies, video titles and descriptions are not translated; emails and the offline page are Should | Translate everything | Staff work in English; halves extraction cost; authored text is a separate content problem | Yes |
| L7-D6 | A stale translation stays visible until reviewed; a changed meaning needs a new key | Fall back to English on any change | English edits are mostly typo fixes; hiding good translations would punish them | Yes |
| L7-D7 | Engine: NLLB-200 distilled 1.3B on a self hosted CTranslate2 sidecar, behind a `Translator` interface with Google and LLM adapters; Pidgin human first | Google only, LLM only, MADLAD | Free to run, offline after setup, fits the stack; the interface keeps the choice open | Yes |
| L7-D8 | Machine translation is triggered by an admin only, always lands as a draft, never auto publishes, never triggered by a viewer | On demand for viewers, auto publish | Unreviewed text must not reach children; cost control | Yes |
| L7-D9 | A caption language is visible only if its track is approved and published and its language is on the site list | Approved is enough | Allows approve many then publish once, and a site wide kill switch | Yes |
| L7-D10 | Add the vietnamese font subsets loaded by unicode-range, Inter as the per glyph fallback for Poppins and display fonts; correct DESIGN-SYSTEM 5.1 | Self made subsets, drop Poppins, system fallback | Smallest change, English pays nothing, same licences | Yes |
| L7-D11 | Whisper: keep `small.en` for English, optional `WHISPER_MODEL_MULTI` (`medium`) for other languages and Auto; Igbo not generated; Pidgin decoded as English; refuse rather than mis-transcribe | One multilingual model for all, large-v3 | English quality and speed stay as they are; honest about what Whisper cannot do | Yes |
| L7-D12 | A language goes Live at 80 percent of core keys approved, Super admin may override with a reason | No gate, 100 percent | Prevents a mostly English page labelled as Yoruba while allowing a start | Yes |
| L7-D13 | CSV exports carry a UTF-8 BOM; imports accept either | Plain CSV | Excel corrupts diacritics without a BOM | Yes |
| L7-D14 | Plurals use `Intl.PluralRules` with English fallback; durations and relative days come from the catalog | ICU message syntax, a library | No new dependency; matches D-153 | Yes |
| L7-D15 | The picker is hidden in kids profiles and when one language is enabled; parents set a kid's language | Always visible | Matches the kids lock and M26-S05 | Yes |
| L7-D16 | No new translator role at launch: Editor edits, Admin approves and publishes, volunteers use exported files | A translator role | Smaller attack surface, fewer accounts | Yes |
| L7-D17 | The fix to pass the spoken language to the transcriber and the publish gate on the spoken language track ship with slice 16 | Leave English only | The hardcoded `'en'` is a latent bug | Yes |

## 12. Risks and owner questions

Risks
- Extraction volume (slice 7) is large and touches many files other lanes edit. Mitigation: waves, lint list ratchet, append only to shared files, state the rule in `docs/lanes/L7.md`.
- Translation quality: Yoruba tone marks and Igbo dot below letters are often missing in machine output; Pidgin has no orthography standard. Mitigation: mandatory human approval, NFC and a glyph test, a glossary, a reviewer per language before Live.
- Whisper quality for Yoruba and Hausa is weak and Igbo is absent: expect reviewers to retype most cues; set that expectation in the admin messages.
- RAM budget: multilingual whisper and the NLLB sidecar together add roughly 3.5 to 4.5 GB (inferred). Mitigation: both optional, separate compose profiles, one job at a time.
- Licence: NLLB-200 weights are CC-BY-NC 4.0 (see question 1).
- NDPA: `ad_locale` cookie must be listed as functional; an API provider sends caption text to a third party, so the privacy page and DPA brief must name it when enabled.
- Layout: text expansion of 20 to 40 percent and stacked marks; mitigated by the pseudo locale, `--leading-marks` and the 2.5 times length warning.
- Browser Intl data for `pcm`, `ig`, `yo`, `ha` varies by device; mitigated by fallback to `en-NG` formatting, tested.
- Search and diacritics: viewers type "ose" for "ọṣẹ"; accent insensitive search is not in this lane and should be raised with the search owner.
- Migration number and D-number collisions with parallel lanes; renumber on rebase.

Genuine owner questions (all belong in `docs/CLIENT-INPUTS.md`)
1. Is the platform strictly non-commercial and free to viewers for its whole life? NLLB-200 weights are CC-BY-NC 4.0. If there is any commercial use or sponsorship income, the recommended engine changes to MADLAD-400 (Apache-2.0, heavier) or a paid API.
2. Which languages go first, and who are the named native speaker reviewers for each? Also which Pidgin spelling convention to follow.
3. Server size: can the host take about 2 GB more for the translation sidecar and 1.5 to 2 GB more for multilingual speech recognition? If not, the plan uses an API provider for translation and English only recognition.
4. If an API provider is acceptable, what monthly cap in characters (and is sending caption text to a third party acceptable under the privacy policy)?
