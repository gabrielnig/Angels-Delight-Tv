# L14 content lane C3: Setup and settings (module M50)

Worktree `/home/claude/wt2/C3-content`, branches `c3/*`. Raw outputs in `/home/claude/kb-out/C3` (never committed). Demo stack on port 3203, fixture mode, started only inside a batch through `/home/claude/kb-slot.sh /home/claude/kb-out/C3/batch.sh '<commands>'` (the coordinator memory rule: 2 heavy jobs at a time, stop the stack after each batch).

## How to continue (fresh agent)

1. Author first: `scripts/kb-recorder/episodes/<ID>.ts` (use `padSteps` from `c3-helpers.ts` to reach about a minute) and `content/help/en/<path>/<ID>-<slug>.md` with an empty `<!-- kb:steps ID -->` block.
2. Record in a batch: `pnpm kb:update <ID>` (records, copies pictures to `content/help/media/<ID>/`, rewrites the steps block), then `pnpm help:check`, then `pnpm kb:fact-check --article <ID>`.
3. Run `pnpm vitest run scripts/kb-recorder/episodes.test.ts scripts/kb-recorder/coverage.test.ts apps/web/src/lib/admin/kb-episode-coverage.test.ts`, remove closed gaps from `scripts/kb-recorder/coverage-gaps.json`, update this table, open a PR with `gh api`, rebase merge.
4. Delete `.kb-out` (raw webm) after each batch.

## Articles (status)

| Id | Title | Role | State |
|---|---|---|---|
| R04 | Settings dictionary (generated: `pnpm help:settings`, test `settings-reference.test.ts`) | Admin | written |
| C01 | Platform details and the Launch checklist | Admin | episode and article written |
| C02 | Colours, fonts and logo with the Theme editor | Admin | episode and article written |
| C04 | Features and limits: what each switch does | Super admin | episode and article written |
| C05 | Home and Discovery settings | Admin | episode and article written |
| C06 | Edit the legal and About pages | Admin | episode and article written |
| C07 | Invite codes for early access | Admin | episode and article written |
| C10 | Maintenance mode and the notice banner | Super admin | episode and article written |
| C03, C08, C09, C11 to C14, W04, W05, W08, W09, K03, C15 | see below | | to do |

Planned extra ids (plan lacks them): C15 Storage notice and sharing options (Discovery tab), W04/W05/W08/W09/K03 use the plan ids and titles and were taken because the lane brief lists them.

## Differences between the plan and the real UI

- Site settings has 8 tabs, not 7: Platform details, Features and limits, Home, Series names, Discovery, Invite codes, Pages, Maintenance.
- The page editor buttons are Save draft and Save new version (no Save with version note), formatting bar: Bold, Italic, Heading, Bulleted list, Link, Preview.
- The Theme screen has no separate Save and Publish tabs for presets; presets are the Ready made themes list.
- There is no admin screen for SMTP, sender or email status. Email is sent by the platform with settings the developer sets on the server. The only email related settings on screen are Support email, Help centre contact (no screen yet) and Receipt reply address (no screen yet). The Launch checklist line Domain connected only checks that the Domain box is filled.
- No admin control exists yet for: guest audience (features.guest_audience), maturity labels and highest rating for visitors, Trending thresholds, sponsor and donation settings, translation glossary, language threshold. R04 lists each as "No screen yet. Ask the developer".

## Gaps

- Fact checker treats radio choices (ready made themes, fonts, section kinds) as unreadable, so those steps are written as "Check the X and pick one", and the pick is done in the episode.
