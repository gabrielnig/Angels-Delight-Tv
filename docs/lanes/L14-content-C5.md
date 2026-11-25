# L14 content lane C5: Money and sponsors (path M)

Worktree `/home/claude/wt2/C5-content`, branches `c5/*`, demo port 3205, raw output `/home/claude/kb-out/C5` (never committed). Heavy steps run through `/home/claude/kb-slot.sh`.

## Findings that shape the articles (read first)

1. The Sponsors and Donations admin screens read Postgres only. The fixture demo stack had no data for them (the pages failed with a generic error). This lane adds `apps/web/src/lib/data/admin/kb-demo/money.ts`: with `KB_DEMO=on` on a development fixture build, the sponsor, report and donation services read in memory copies of the demo dataset (all marked test). The reset route drops this state. `money-settings.ts` seeds fake demo wording so the Donate and transparency pages exist, and `scripts/kb-stack.sh` adds a throwaway random Paystack test key and receipt secret (never printed, never committed). Demo reauthentication accepts any typed password.
2. No admin screen edits any `donate.*` setting or any `sponsors.*` setting except the master switch on Sponsors. The plan (M07) and the docs say "Settings, Monetization" or "Features", but `SiteSettingsView` has no such tab and `FLAG_KEYS` has no donation switch. So the owner cannot turn donations on, change amounts, wording, bank details or the transparency lines in the admin today. The developer sets them. The articles say so plainly. Follow up for the owner of M48 or M29: add the Monetization tab (plan S169).
3. Real screen words differ from the plan: the sponsor status button is **Approve to run** (not Activate), pictures are added per "creative" (**Add creative**), placements are labelled Home page banner, Video page card, After the video, Before the video. Articles use the real words.
4. Viewer side (what a viewer sees of a sponsor, the sponsor gate) reads the database on the real site and cannot be recorded in fixture mode. Those articles explain it in words.
5. Bank transfer gifts, monthly giving, refunds and manual entry have no admin screen (D-335, slice 13 partial).
6. Sponsor categories refused: the app does not check categories. The plan's sponsor terms list (tobacco, alcohol, betting, adult content, political advertising) is a proposal and open question 3 in the L9 plan, so the article presents it as the owner's own rule to confirm.

## Articles

See the table below. State: todo, written, recorded, checked, merged.

| Id | Title | State |
|---|---|---|
