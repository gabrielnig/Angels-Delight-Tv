# Lane M3: Media processing and brand kit

Seven slices, each merged as its own PR on `lane-m3/*` branches. Decisions D-093, D-098, D-102, D-106, D-107, D-108 and D-109.

## What exists

1. Image processing (`image.process`): `packages/video/src/image/` makes webp and jpeg variants at several widths for poster, hero and thumbnail presets with sharp, stores them through the storage adapter, and the worker registers the handler. `ResponsivePoster` and the card thumbnails render a `picture` with a webp source and a jpeg fallback, and a generated gradient poster with the title when there is no art. Admins upload custom posters in the poster picker, which polls processing status. Encoder candidate frames also go through this queue.
2. Sprite seek previews: the encoder makes 160 px sheets (one frame per 5 s, 5 by 5 tiles, at most 10 sheets) and a VTT map under `cap/{prefix}/sprites/`. `videos.sprite_key` (migration 0022) holds the map. The player seek bar shows a lazy hover preview and turns it off with Data saver.
3. Failed encode cleanup: `FailedEncodeService` lists failed encodes and removes partial output only (never the original or captions). Screen at `/admin/encoding/failed` with Retry, Clean up, Clean up all, and Replace file through the uploader.
4. Caption script alignment: `alignScript` aligns an admin script to recognised words (sequence alignment), keeps the script wording and takes timing from the audio. Cues with unheard, guessed or low probability words are saved with `captions.low_confidence_cues` (migration 0024) and shown as "Check this cue" in review, with an only-to-check filter and a script panel.
5. Placeholder brand kit: `pnpm brand:generate` builds the SVG icon and wordmark, favicon, home screen icons, Open Graph image and email header from one source (`packages/launch/src/brand/kit.ts`) into `apps/web/public/icons`. Favicon and Open Graph image are served by `/brand-icons/*`. The client logo replaces them through the admin logo upload and `pnpm launch:apply` (`PWA_ICONS_DIR` wins over bundled files).
6. Theme presets: six ready themes in `packages/theme/src/presets.ts`, each tested against the contrast gate with no blockers or warnings, selectable in the admin theme editor (`PresetPicker`). The e2e `apps/web/e2e/theme-publish.e2e.ts` publishes a preset, font and name and checks viewer pages, manifest `theme_color` and the next email.
7. Branded emails: `Mailer` takes a per-send `brand()` lookup. `emailBrandFrom` (`apps/web/src/server/auth/email-brand.ts`) reads `platform.name`, the published colours and the logo.

## Exported APIs

- `@ad/video`: `processImage`, `IMAGE_PRESETS`, `ImageService`, `FailedEncodeService`, `alignScript`, `cuesFromAlignment`, `planSprite`, `buildSpriteVtt`, `CaptionService.previewScript/saveScript/getScript`.
- `@ad/catalog`: `listPosterAssets`, `createPosterUpload`, `getPosterAssetStatus`.
- `@ad/player`: `parseSpriteVtt`, `findTile`, `SpriteLoader`.
- `@ad/theme` and `@ad/theme/client`: `THEME_PRESETS`, `findPreset`.
- `@ad/mailer`: `BrandContext` gains `logoUrl` and theme colours, `MailerSettings.brand`.
- `@ad/launch`: `buildBrandKit`, `iconSvg`, `wordmarkSvg`, `BRAND_KIT_FILES`.

## Routes

`/admin/encoding/failed`, `/admin/theme` (preset picker), `/admin/captions/[id]` (script panel), `/admin/videos/[id]` (poster upload), `/admin/upload?replace=<videoId>`, `/brand-icons/{file}` (adds `favicon-32.png` and `placeholder-og.png`).

## Scoped test commands

```
pnpm vitest run packages/video/src/image packages/catalog/src/admin/posters
pnpm vitest run packages/video/src/sprite packages/player/src/sprite apps/web/src/components/player
pnpm vitest run packages/video/src/lifecycle apps/web/src/components/admin/FailedEncodes
pnpm vitest run packages/video/src/captions apps/web/src/components/admin/captions
pnpm vitest run packages/launch/src/brand apps/web/src/lib/pwa/brand-icons.test.ts
pnpm vitest run packages/theme/src/presets.test.ts apps/web/src/components/admin/theme
pnpm vitest run packages/mailer apps/web/src/server/auth/email-brand.test.ts
```

Integration tests (`*.int.test.ts`) need `TEST_DATABASE_ADMIN_URL`. The e2e needs `scripts/e2e-video-up.sh` and runs with `E2E_THEME=1 E2E_SMTP_PORT=1025 E2E_CHROMIUM_PATH=/opt/google/chrome/chrome pnpm exec playwright test e2e/theme-publish.e2e.ts --project=desktop` from `apps/web`.

## Gaps

- No real faster-whisper model was run for alignment, only fixtures.
- The sprite `video.sprites` switch is not wired to settings. Candidate frames for older videos are not backfilled.
- Hero and series art presets only apply to assets with those purposes. Poster and hero files are not removed on purge (`ImageService.remove` exists). Poster focus is a display concern and is not applied in server cropping.
- `launch:apply` replaces only the four home screen icons, not the favicon or Open Graph image.
- Email logos are WebP, which Outlook desktop does not show (the site name alt text shows instead).
- The e2e Watch check loads the Watch route without a real video, so it proves the root layout theme, not a playing video.
- Presets set colours only, not font or sizes.
