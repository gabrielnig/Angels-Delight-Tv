# L14 Admin knowledge base: help centre with text, silent captioned video and screenshots (module M50)

Status: planning pass, docs only. Nothing is generated yet: no article, no video, no screenshot. Date: 25 November 2026. Base: origin/main 6835b9bc. Requested by Unique (developer) for the handover to Sister Vanessa. Unique approves this plan before any content is made.

Every choice below takes the recommended option (CLAUDE.md "Decisions") and is logged as D-359 to D-365 in `docs/DECISIONS.md` (section 20). Where something could not be verified in code from this pass it is marked "verify at build" and becomes a check in the fact checking lane.

Related and not duplicated here: the recording feasibility spike (`docs/spikes/kb-recording.md`, not on origin/main at the base above, so this plan states the harness it needs and the spike confirms or changes the details) and the screen mockups (`docs/mockups/v2/L14`, drawn by another agent). This plan lists the screens the mockups must cover (section 18) and does not draw them.

## 1. Goals and audience

### 1.1 Goal

When the developer hands the platform over, Sister Vanessa, who is not technical, can run it herself: add and publish a video, look after captions, curate Home, change the look, invite a teammate, handle sponsors and donations, read the numbers, and recover from a mistake, without calling anyone for routine work.

The knowledge base (KB, the help centre) is the one place that explains every admin screen and task, in three forms that say the same thing: text steps, a short silent video with captions, and screenshots with numbered marks. It is also a learning course: seven ordered paths take a new person from "where do I click" to "I run the weekly routine".

### 1.2 Success measures

| Measure | Target |
|---|---|
| Vanessa test: a non technical person, shown only the KB, completes the 12 core tasks in section 14.4 | 12 of 12, no help from the developer |
| Coverage: every admin route, every side menu item, every permission action and every setting appears in a KB article or a generated reference | 100 percent, enforced by tests (section 12.3) |
| Freshness: a screen change that breaks a recorded procedure fails CI before merge | Yes, for the affected articles |
| Time to find an answer by search | Under 30 seconds for the 12 core tasks |
| Every video | 1 to 4 minutes, readable with sound off, captions only |

### 1.3 Audience and roles (from the real code)

Roles in the code are `viewer`, `editor`, `admin`, `super_admin` (`packages/shared/src/enums.ts`). Only the last three reach `/admin` (`admin.access` is Editor). In the KB they are called Editor, Admin and Super admin. `docs/SCREEN-ARCHITECTURE.md` section 3.3 still mentions an "Analyst" role that does not exist in the code, and says System is Super admin only where the code lets an Admin view it. The KB follows the code (finding F1, decision D-365).

| Person | Role | What the KB must do for them |
|---|---|---|
| Sister Vanessa, owner of the platform | Super admin (assumed, confirm at launch) | Teach everything, including roles, features and limits, money |
| A trusted staff member she appoints | Admin | Teach content, settings, users, reports |
| A volunteer who adds and tidies videos | Editor | Teach upload, details, captions, series, categories, Home, analytics |
| The developer (Unique, ARKDEV) | Super admin | Maintainer of the KB, not the target reader |

What each role sees in the admin side menu today (derived from `NAV_ITEMS` in `apps/web/src/components/admin/nav.ts` and the matrix in `apps/web/src/lib/admin/can.ts`):

| Group | Item | Editor | Admin | Super admin |
|---|---|---|---|---|
| Overview | Dashboard | yes | yes | yes |
| Content | Videos, Upload, Encoding, Captions, Series, Categories, Trash | yes | yes | yes |
| Site | Home curation, Languages | yes | yes | yes |
| Site | Theme, Site settings | no | yes | yes |
| Insight and control | Analytics, Exports | yes | yes | yes |
| Insight and control | Users, Audit log, System | no | yes (Audit log shows content actions only) | yes (everything) |
| Insight and control | Roles and invites | no | no | yes |
| Monetization | Sponsors | yes | yes | yes |
| Monetization | Donations | no | yes | yes |

Role limits inside screens that all three can open (examples the articles must state): delete a video and purge from Trash are Admin and up, approve captions in bulk and switch captions off for a video are Admin and up, delete a series is Admin and up, activate a sponsor and export a sponsor report are Admin and up, change features and limits and retry failed jobs on System are Super admin only. Each article carries a "Who can do this" line generated from `can.ts` so it can never drift (section 12.3).

### 1.4 Non goals

- A guide for viewers. The viewer Help page (`/help`, route group `(site)`) stays as it is.
- A public documentation site, a forum, chat support or a ticket system.
- Spoken narration, music or sound of any kind in the videos.
- Developer and operator documentation (deploy, backup, secrets). That stays in `docs/LAUNCH-RUNBOOK.md` and `docs/DEPLOYMENT.md`. The KB links to a short "Ask the developer" article (T11) for those.
- Machine translation of the KB in this phase.

## 2. Scope and complete inventory

### 2.1 Admin routes (41, from `apps/web/src/app/admin`, nothing invented)

Minimum role is taken from `can.ts` and the nav. "Articles" are the KB ids in section 3.

| # | Route | Screen | Min role | Tasks on it | Articles |
|---|---|---|---|---|---|
| 1 | `/admin/login` | Admin sign in | none | Sign in, locked account | S02, T06 |
| 2 | `/admin/login/2fa` | Two step code and enrolment | partial session | Enter code, enrol, recovery codes | S02, T06 |
| 3 | `/admin/invite/[token]` | Accept invite | none | Set password, enrol two step | S03 |
| 4 | `/admin` | Dashboard | Editor | Read tiles, Needs attention, recent uploads, storage, 7 day views, Start here steps | D01, S06 |
| 5 | `/admin/videos` | Videos list | Editor | Search, filter, select, bulk publish, unpublish, trash, add category, suitability | D10, D08, D11 |
| 6 | `/admin/videos/upload` | Upload | Editor | Drop files, queue, pause, cancel, retry, parallel uploads setting, shared details, per file overrides | D02, D03, D04, T05 |
| 7 | `/admin/videos/[id]` | Video editor | Editor | Details, categories, tags, rating and suitability, series and episode, status checklist, publish, schedule, captions switch, Delete | D05, D08, D09, W09, K01, K02, T02 |
| 8 | `/admin/videos/[id]/poster` | Poster picker | Editor | Pick one of six, upload own, crop and focus | D06 |
| 9 | `/admin/videos/[id]/preview` | Preview as viewer | Editor | Watch as a viewer would, staff session only | S07 |
| 10 | `/admin/videos/[id]/markers` | Skip and chapters editor | Editor | Skip intro, recap, credits, chapters | W06 |
| 11 | `/admin/videos/trash` | Trash | Editor | Restore, Delete forever (Admin), 30 day wait | D11, W13 |
| 12 | `/admin/encoding` | Encoding queue | Editor | Watch progress, retry, bulk retry | D12, T01 |
| 13 | `/admin/encoding/failed` | Failed encodes | Editor | Read the plain reason, retry, clean up | D12, W13, T01 |
| 14 | `/admin/captions` | Caption list | Editor | See what waits, filter, bulk approve (Admin) | D07 |
| 15 | `/admin/captions/[videoId]` | Caption review | Editor | Edit cues, find and replace, split, merge, undo, regenerate, download, upload, approve, languages, translation, publish a language | D07, W07, W08, T03 |
| 16 | `/admin/series` | Series list | Editor | Create, search, delete (Admin) | W01 |
| 17 | `/admin/series/[id]` | Series editor | Editor | Details, seasons, episodes, reorder, add episode | W01, W02 |
| 18 | `/admin/categories` | Categories | Editor | Add, rename, hide, reorder, delete with reassign | W03 |
| 19 | `/admin/home` | Home curation | Editor | Hero slots, hero text, preview clips, sections, reorder, View all, minimum titles, kids visible, restore launch layout, desktop and mobile preview | W04, W05 |
| 20 | `/admin/theme` | Theme editor | Admin | Presets, colours, fonts, logo and name, contrast check, save draft, publish, reset | C02 |
| 21 | `/admin/theme/history` | Theme history | Admin | Filter, restore an earlier theme | C03 |
| 22 | `/admin/site-settings` | Site settings (7 tabs: Platform details, Features and limits, Home, Discovery, Invite codes, Pages, Maintenance) and Launch checklist | Admin (Features: Super admin) | All settings, pages with versions, invite codes, maintenance, search synonyms | C01, C04, C05, C06, C07, C10, K02, K03 |
| 23 | `/admin/languages` | Languages | Editor (view) | Status per language, publish, import, export | C08 |
| 24 | `/admin/languages/[locale]` | Translate workspace | Editor | Missing, Stale, In review, Approved, All, Viewer hits, import and export | C09 |
| 25 | `/admin/analytics` | Analytics overview | Editor | Date range, tiles, trend, top titles, splits | W10 |
| 26 | `/admin/analytics/[id]` | Per video analytics | Editor | Daily views, where viewers stop | W11 |
| 27 | `/admin/exports` | Exports list | Editor | Download, status, too big for browser | W12 |
| 28 | `/admin/exports/new` | New export | Editor | Choose audit or analytics, confirm | W12 |
| 29 | `/admin/users` | Viewer accounts | Admin | Search, filter, bulk | K04 |
| 30 | `/admin/users/[id]` | Account detail | Admin | Sign out everywhere, Suspend, Reset two step, Delete account (Super admin) | K04, K05 |
| 31 | `/admin/roles` | Roles and invites | Super admin | Staff table, invite, pending invites, permission matrix, change role, bulk | C11, C12 |
| 32 | `/admin/audit-log` | Audit log | Admin | Filter, detail drawer, export (Super admin) | K06 |
| 33 | `/admin/system` | System (tabs: Jobs, Storage, Player quality) | Admin (Jobs retry: Super admin) | Failed jobs, storage use and estimate, startup and rebuffer | C14, T10 |
| 34 | `/admin/account` | My account | any staff | Password, two step and recovery codes, sessions, notification choices | C13, K07 |
| 35 | `/admin/sponsors` | Sponsors list and master switch | Editor | List, master switch (password re-check), statuses | M01, M02 |
| 36 | `/admin/sponsors/new` | New sponsor | Editor | Name, dates, contact, notes | M03 |
| 37 | `/admin/sponsors/[id]` | Sponsor detail | Editor | Images, placements, status panel (activate, pause, archive, delete) | M03, M04, M05 |
| 38 | `/admin/sponsors/[id]/report` | Sponsor report | Editor | Range, totals, by image and placement, CSV (Admin) | M06 |
| 39 | `/admin/sponsors/[id]/report/print` | Printable report | Editor | Print or save as PDF | M06 |
| 40 | `/admin/donations` | Donations | Admin | Totals, filters, CSV export | M08 |
| 41 | `/admin/donations/[id]` | Gift detail | Admin | Reveal donor email (audited), settle a gift that needs review | M09 |

Cross cutting admin features covered inside the articles above: top bar (menu, bell, upload progress chip, My account, Preview site, Sign out), session expiry warning dialog, bulk bar and results with Undo, breadcrumbs, empty and error states with reference codes, the Launch checklist panel, the notice bell.

Existing in app help today (to reuse, not replace): the Dashboard "Start here" card (three steps), `EmptyState` and `ErrorState` help lines, field `hint` text (`apps/web/src/components/admin/fields.tsx`), page header lead lines (`PageHeader`), dialog copy. There is no help route, no tooltip component and no help link. The KB adds a Help link in `PageHeader` and a contextual help button (section 7.3).

### 2.2 Inventory totals

| Item | Count |
|---|---|
| Admin routes | 41 |
| Side menu items | 20 |
| Tabs inside screens | Site settings 7, System 3, Theme preview 3, Home preview 2, Languages workspace 6 |
| Permission actions in `can.ts` | 42 |
| Settings in the registry (`packages/theme/src/settings-registry.ts`) | generated reference (R04), count read at build |
| KB articles | 83 (section 3) |
| KB videos | 73 desktop recordings plus 16 phone recordings (section 4) |
| Screenshots | about 500 (section 6.5) |

## 3. Information architecture

### 3.1 Structure

One home page at `/admin/help` with: a search box, "Start here" first, the seven learning paths as cards, the 12 core tasks as quick links, "Reference" (glossary, roles, screen map, settings), and "Print or download the handbook".

Seven learning paths, in learning order. A path is an ordered playlist: each article ends with "Next: ..." and each video outro names the next one. Reference sits beside the paths and is text only.

| Path | Code | Articles | Videos | Purpose |
|---|---|---|---|---|
| Start here | S | 8 | 8 | Sign in, find your way, first video |
| Daily tasks | D | 12 | 12 | What an Editor does every day |
| Weekly tasks | W | 27 | 27 | Series, Home, captions in depth, numbers |
| Setup and settings | C | 14 | 14 | Brand, switches, pages, languages, team, system |
| Money and sponsors | M | 9 | 9 | Sponsors and donations |
| Safety and kids | K | 8 | 7 | Kids, ratings, guests, accounts, audit, privacy |
| Troubleshooting | T | 11 | 10 | Symptom to fix |
| Reference | R | 8 | 0 | Glossary, roles, screen map, settings, keys, statuses, checklists, what is new |
| Total | | 83 | 73 | |

Id rules: `S01` style, never reused, never renumbered (links and printed copies depend on them). Video id is the article id with a `V` prefix (`VD02`). A phone recording adds `-p` (`VD02-p`). Article url: `/admin/help/D02`. Path url: `/admin/help/path/daily`. Video url: the article page, `?t=` is not needed.

Columns: Role is who can do the task (E Editor and up, A Admin and up, S Super admin only, "E, A" means the task is Editor with a part for Admin). Needs is what to read first. Read is minutes of reading, Watch is minutes and seconds of video, Phone marks the 16 articles that also get a phone recording. Related lists up to three other ids.

### 3.2 Start here (S)

| Id | Title | Role | Needs | Read | Watch | Phone | Related |
|---|---|---|---|---|---|---|---|
| S01 | Welcome: what this platform does and what you can do | E | none | 2 | 1:30 | no | S04, S06 |
| S02 | Sign in and set up two step sign in | E | none | 3 | 2:30 | yes | S03, T06, C13 |
| S03 | Accept your invite and set your password | E | invite email | 2 | 2:00 | no | S02, C11 |
| S04 | Find your way around: menu, top bar and phone menu | E | S02 | 3 | 2:30 | yes | S05, S08 |
| S05 | Who can do what: Editor, Admin and Super admin | E | S04 | 3 | 2:00 | no | R02, C11, C12 |
| S06 | Your first video from start to finish | E | S02, S04 | 4 | 4:00 | no | D02, D07, D08 |
| S07 | See your site the way a viewer sees it | E | S04 | 2 | 1:30 | no | D08, D07 |
| S08 | Use this help centre: search, print, offline | E | none | 2 | 1:30 | no | R01, R05 |

### 3.3 Daily tasks (D)

| Id | Title | Role | Needs | Read | Watch | Phone | Related |
|---|---|---|---|---|---|---|---|
| D01 | Check the Dashboard | E | S04 | 2 | 2:00 | yes | D12, D07 |
| D02 | Upload one video | E | S04 | 4 | 3:30 | yes | D03, D04, D05 |
| D03 | Upload many videos and share details | E | D02 | 4 | 3:30 | no | D04, D10 |
| D04 | Fix an upload that stopped or failed | E | D02 | 3 | 2:30 | no | T05, D02 |
| D05 | Add the title, description and categories | E | D02 | 4 | 3:00 | yes | D06, W03, K01 |
| D06 | Choose or upload a poster | E | D05 | 3 | 2:30 | no | D08, D05 |
| D07 | Review and approve captions | E | D02 | 5 | 4:00 | yes | W07, W08, T03 |
| D08 | Publish or unpublish a video | E | D05, D07 | 3 | 2:30 | yes | D09, T02, S07 |
| D09 | Schedule a video for later | E | D08 | 3 | 2:30 | no | D08, T02 |
| D10 | Find videos and change many at once | E | S04 | 4 | 3:00 | yes | D11, D08 |
| D11 | Delete a video and restore it from Trash | E, A | D10 | 3 | 2:30 | no | W13, T07 |
| D12 | Watch the Encoding queue and retry a failed video | E | D02 | 3 | 3:00 | yes | T01, W13 |

### 3.4 Weekly tasks (W)

| Id | Title | Role | Needs | Read | Watch | Phone | Related |
|---|---|---|---|---|---|---|---|
| W01 | Create a series and add episodes | E | D05 | 4 | 4:00 | no | W02, D05 |
| W02 | Reorder episodes and seasons | E | W01 | 2 | 2:00 | no | W01 |
| W03 | Manage categories | E | S04 | 3 | 3:00 | no | D05, W04 |
| W04 | Arrange the Home rows | E | W03 | 4 | 4:00 | no | W05, C05 |
| W05 | Choose hero banners and preview clips | E | W04 | 4 | 3:30 | no | W04, C05 |
| W06 | Add skip intro, recap and chapters | E | D08 | 3 | 3:30 | no | S07 |
| W07 | Edit captions in detail | E | D07 | 4 | 3:30 | no | W08, T03 |
| W08 | Add a caption language and publish it | E, A | W07 | 4 | 4:00 | no | C08, W09 |
| W09 | Turn captions on or off for one video | A | D07 | 2 | 1:30 | no | T03, C04 |
| W10 | Read Analytics | E | S04 | 4 | 3:30 | yes | W11, W12 |
| W11 | See how one video is doing | E | W10 | 2 | 2:00 | no | W10 |
| W12 | Make and download a report | E | W10 | 3 | 2:30 | no | M06, K06 |
| W13 | Clean up Trash and failed encodes | E, A | D11, D12 | 2 | 2:00 | no | D11, D12 |
| W20 | Plan a series: groups and items | E | S04 | 3 | 1:00 | no | W01, W21, W23 |
| W21 | Choose the series names for your whole site | A | W20 | 3 | 1:15 | no | W22, W01, W27 |
| W22 | Use different names for one series | E | W21 | 2 | 1:00 | no | W21, W20, W01 |
| W23 | Add many videos to a series | E | W20 | 4 | 1:30 | no | W02, W25, W01 |
| W24 | Move a lesson to another group and rename groups | E | W02 | 3 | 1:30 | no | W02, W25 |
| W25 | Fix gaps and duplicate numbers | E | W02 | 3 | 1:30 | no | W02, W23, W24 |
| W26 | Set a series maturity rating and apply it to every lesson | E | W01 | 3 | 1:30 | no | K02, W27 |
| W27 | See how a series looks to viewers | E | W01 | 4 | 2:00 | yes | S07, W28 |
| W28 | Remove a series without losing videos | E, A | W01 | 3 | 1:30 | no | W01, D11 |
| W29 | Organise your library with categories and tags | E | W03 | 3 | 1:30 | no | W03, D05 |
| W30 | Change many videos at once: publish, rating, category | E | D10 | 4 | 2:00 | no | D10, W23 |
| W31 | Approve many captions at once | A | D07 | 3 | 1:30 | no | D07, W09 |
| W32 | Retry many failed encodes at once | E | D12 | 2 | 1:30 | no | D12, T01 |
| W33 | Upload many videos and set the details together | E | D03 | 3 | 1:30 | no | D03, W30 |

### 3.5 Setup and settings (C)

| Id | Title | Role | Needs | Read | Watch | Phone | Related |
|---|---|---|---|---|---|---|---|
| C01 | Platform details and the Launch checklist | A | S05 | 4 | 3:30 | no | C02, C05 |
| C02 | Colours, fonts and logo with the Theme editor | A | C01 | 5 | 4:00 | no | C03, T08 |
| C03 | Go back to an earlier theme | A | C02 | 2 | 2:00 | no | C02, T07 |
| C04 | Features and limits: what each switch does | S | S05 | 5 | 4:00 | no | R04, K03, C10 |
| C05 | Home and Discovery settings | A | W04 | 4 | 3:30 | no | W04, W05, C06 |
| C06 | Edit the legal and About pages | A | C01 | 4 | 3:30 | no | C01 |
| C07 | Invite codes for early access | A | C04 | 3 | 2:30 | no | K03, C04 |
| C08 | Publish an interface language | E, A | W08 | 3 | 3:30 | no | C09, W08 |
| C09 | Translate the site text | E | C08 | 4 | 4:00 | no | C08 |
| C10 | Maintenance mode and the notice banner | A | C04 | 2 | 2:00 | no | T07 |
| C11 | Invite a teammate and choose their role | S | S05 | 3 | 3:00 | yes | C12, S03 |
| C12 | Change a role, remove access, reset two step | S | C11 | 3 | 3:00 | no | C11, T06 |
| C13 | Your own account: password, two step, devices | E | S02 | 3 | 3:00 | yes | K07, T06 |
| C14 | System: jobs, storage and player quality | A, S | S05 | 4 | 3:30 | no | T10, T01 |

### 3.6 Money and sponsors (M)

| Id | Title | Role | Needs | Read | Watch | Phone | Related |
|---|---|---|---|---|---|---|---|
| M01 | How sponsors and donations work | E | S05 | 3 | 2:30 | no | M02, M07, K01 |
| M02 | Turn sponsors on | A | M01 | 2 | 2:00 | no | M03 |
| M03 | Add a sponsor and its images | E | M02 | 5 | 4:00 | no | M04, M05 |
| M04 | Choose where a sponsor shows and for how long | E, A | M03 | 3 | 3:00 | no | M03, K01 |
| M05 | Pause, archive or delete a sponsor | E, A | M03 | 2 | 2:00 | no | M04 |
| M06 | Read a sponsor report and print it | E, A | M04 | 4 | 3:30 | no | W12 |
| M07 | Set up donations: what you set and what the developer sets | A | M01 | 5 | 4:00 | no | M08, C04 |
| M08 | See donations and download the list | A | M07 | 3 | 3:00 | no | M09, W12 |
| M09 | Settle a gift that needs review | A | M08 | 3 | 3:00 | no | T09, K06 |

### 3.7 Safety and kids (K)

| Id | Title | Role | Needs | Read | Watch | Phone | Related |
|---|---|---|---|---|---|---|---|
| K01 | Make a video safe for Kids mode | E | D05 | 3 | 3:00 | no | K02, M01 |
| K02 | Maturity ratings and the highest rating guests can see | E, A | K01 | 3 | 3:00 | no | K03, C04 |
| K03 | Let visitors watch without an account | A, S | C04 | 3 | 2:30 | no | K02, C07 |
| K04 | Suspend an account and sign someone out everywhere | A | S05 | 3 | 3:00 | yes | K05, T06 |
| K05 | Reset a viewer's two step sign in and delete an account on request | A, S | K04 | 3 | 3:00 | no | K04, K06 |
| K06 | Read the audit log: who did what | A, S | S05 | 3 | 3:00 | no | W12, K07 |
| K07 | Keep the admin safe | E | S02 | 3 | 2:30 | no | C13, T06 |
| K08 | What data we keep and for how long | A | S05 | 3 | none | no | K05, R01 |

### 3.8 Troubleshooting (T)

| Id | Title | Role | Needs | Read | Watch | Phone | Related |
|---|---|---|---|---|---|---|---|
| T01 | A video is stuck on Encoding | E | D12 | 3 | 2:30 | yes | D12, C14 |
| T02 | A video will not publish | E | D08 | 3 | 2:30 | yes | D05, D07, D09 |
| T03 | Captions are missing or wrong | E | D07 | 3 | 2:30 | no | W07, W09 |
| T04 | Viewers say a video will not play | E | D08 | 3 | 2:30 | no | T01, S07 |
| T05 | An upload keeps failing | E | D04 | 3 | 2:30 | no | D04 |
| T06 | I cannot sign in or I lost my phone | E | S02 | 3 | 2:00 | yes | C12, K04 |
| T07 | I changed something by mistake: undo and restore | E | S04 | 3 | 2:30 | no | D11, C03 |
| T08 | The site looks wrong after a theme change | A | C02 | 2 | 2:00 | no | C03 |
| T09 | A donation is missing or still pending | A | M08 | 3 | 2:30 | no | M09 |
| T10 | Storage is nearly full | A | C14 | 3 | 2:00 | no | C14, D11 |
| T11 | Ask the developer: what to send | E | none | 2 | none | no | T01, R01 |

### 3.9 Reference (R), text only

| Id | Title | Built how | Read |
|---|---|---|---|
| R01 | Glossary | Hand written, checked against `docs/GLOSSARY.md` | 5 |
| R02 | Roles and permissions | Generated from `can.ts` with plain language action names | 4 |
| R03 | Screen map: every screen and where to click | Generated from `NAV_ITEMS` and the route table in section 2 | 4 |
| R04 | Settings dictionary: every setting, what it does, its default, who can change it | Generated from the settings registry | 8 |
| R05 | Keyboard and accessibility in the admin | Hand written, checked by the fact checker | 3 |
| R06 | Status words: Draft, Scheduled, Published, Unpublished, Uploading, Encoding, Ready, Failed, and the caption states | Generated from the enums plus hand written meaning | 3 |
| R07 | Checklists: before launch, every day, every week, every month (printable) | Hand written from the paths | 3 |
| R08 | What is new: changes to the admin by release | Written per release from `CHANGELOG.md` | 2 |

### 3.10 Totals check

Articles 8 + 12 + 13 + 14 + 9 + 8 + 11 + 8 = 83. Videos 8 + 12 + 13 + 14 + 9 + 7 + 10 = 73 (K08, T11 and all of R have none). Phone recordings 16 (S02, S04, D01, D02, D05, D07, D08, D10, D12, W10, C11, C13, K04, T01, T02, T06). Total video runtime and reading time are in section 15.1.

### 3.11 Aliases for search

Plain words people use that differ from the screen words are stored in front matter `aliases` and feed search: poster (thumbnail, cover, picture), publish (go live, release), Trash (bin, deleted), captions (subtitles, CC), categories (genres, topics), Encoding (processing, converting), series (show, season, programme), sponsors (adverts, ads), donations (gifts, giving), Roles (permissions, access), kids (children, child safe).

## 4. The video playlist

Rules for every video (full style guide in section 5): silent, open (burned in) captions, 1 to 4 minutes, one task, recorded from the real admin screens by Playwright on the demo stack (section 11), 1280 by 720 desktop, phone recordings 390 by 844 portrait, a 3 second title card (title, who it is for, length) and a 3 second end card (next video id and title), no music, no voice. Cue density: about 8 to 10 captions per minute.

An outline below is the script skeleton: the beats become the `say` lines of the flow file (section 10.2). Final wording is written in the script lane and checked by the fact checker; an outline is not final copy. Watch times are in section 3.

### 4.1 Start here

- **VS01 Welcome** (E). Beats: this is your admin; the side menu on the left has everything; Content is where videos live; Site is how it looks; Insight is numbers and people; this help centre is always one click away; start with Your first video.
- **VS02 Sign in and set up two step sign in** (E, phone). Beats: open the admin address; type your email and password; enter the 6 digit code from your authenticator app; first time: scan the QR code; copy and keep the recovery codes; tick that you saved them; you are in.
- **VS03 Accept your invite** (E). Beats: open the email; click the invite link; check the role shown; choose a password, watch the checklist turn green; scan the QR code; save recovery codes; you land on the Dashboard.
- **VS04 Find your way around** (E, phone). Beats: side menu groups; menu items you cannot see are hidden for your role; top bar shows upload progress and your account; Preview site opens the viewer side; on a phone the menu opens from the menu button; how to sign out.
- **VS05 Who can do what** (E). Beats: three staff roles; Editor looks after content; Admin also sets the look and handles accounts; Super admin also controls the team and the switches; the Roles screen shows the full list (Super admin); ask a Super admin if a button is greyed out.
- **VS06 Your first video** (E). Beats: Dashboard Start here; upload a demo file; wait for it to finish; add a title and categories; pick a poster; approve captions; publish; see it on Home with Preview site.
- **VS07 See your site as a viewer** (E). Beats: Preview site in the top bar opens the real site; open a draft with Preview as viewer on the video screen; only staff can open a preview link; check captions and quality; close the tab to return.
- **VS08 Use this help centre** (E). Beats: the Help button in the top bar; the Help link in each page header opens the matching article; search with the box or press the slash key; every article has a video, steps and pictures; Print or Save as PDF; download the handbook for offline use.

### 4.2 Daily tasks

- **VD01 Check the Dashboard** (E, phone). Beats: tiles for published, drafts, processing, failed; Needs attention lists what waits for you; click an item to go straight there; recent uploads; storage used; views in the last 7 days; an empty list says All clear.
- **VD02 Upload one video** (E, phone). Beats: Upload in the side menu; drag a file or click to choose; MP4, MOV or MKV; watch the percent bar; leave the page open until Done; the video appears in Videos as a draft; next, add details.
- **VD03 Upload many videos and share details** (E). Beats: drop several files; they upload side by side; set the parallel uploads number; Edit details for all: category, rating, suitability; override one file; check the summary; Done.
- **VD04 Fix an upload that stopped or failed** (E). Beats: a row says Paused or Failed; the saved part is kept; click Retry; or Cancel and start again; check your connection; the row turns Done.
- **VD05 Add the title, description and categories** (E, phone). Beats: open the video from Videos; write a title that says what viewers learn; description starts with a verb; counters show the limit; choose categories and tags; choose the maturity rating and suitability; Save changes.
- **VD06 Choose or upload a poster** (E). Beats: Poster on the video screen; six suggested frames; click the best one; or Upload your own; crop and set the focus point; check the safe area; Save poster.
- **VD07 Review and approve captions** (E, phone). Beats: Captions in the menu; open the oldest first; play the video with the cue list beside it; fix wrong words; read warnings for long lines; Approve when it reads right; state turns Approved.
- **VD08 Publish or unpublish a video** (E, phone). Beats: the checklist must be green; click Publish; choose Publish now; confirm; the badge says Published; to hide it again choose Unpublish.
- **VD09 Schedule a video for later** (E). Beats: Publish; choose Schedule; pick the date and time, Lagos time; confirm; the status says Scheduled; it goes live by itself; change or cancel before then.
- **VD10 Find videos and change many at once** (E, phone). Beats: search by title; filters for status, category, captions, suitability; tick rows; the bar shows how many are selected; choose an action; confirm; read the result; Undo if you need.
- **VD11 Delete a video and restore it** (E, A). Beats: Delete is for Admins; type to confirm; the video goes to Trash for 30 days; open Trash in the menu; Restore brings it back; Delete forever cannot be undone.
- **VD12 Watch the Encoding queue and retry** (E, phone). Beats: Encoding in the menu; each row shows the stage and percent; wait, it updates by itself; a failed row shows a plain reason; Retry; select several and Retry all; open Failed encodes.

### 4.3 Weekly tasks

- **VW01 Create a series and add episodes** (E). Beats: Series, then New series; title and description; add a season; Add episode and search for a video; set the episode number; Save; open it on the site.
- **VW02 Reorder episodes and seasons** (E). Beats: open a series; drag the handle, or use Up and Down; duplicate numbers show a warning; Save; check the order.
- **VW03 Manage categories** (E). Beats: Categories; Add a category; rename in place; hide with the switch; reorder; Delete asks where to move the videos; confirm.
- **VW04 Arrange the Home rows** (E). Beats: Home curation; rows are called sections; rename; drag to reorder; Visibility switch; View all setting and minimum titles; Add a section; Restore the launch layout; check Desktop and Mobile preview.
- **VW05 Choose hero banners and preview clips** (E). Beats: up to five hero slots; choose a title for each; write headline, description and button label; preview clip: Automatic, a start point or Off; check the preview; Save.
- **VW06 Add skip intro, recap and chapters** (E). Beats: Skip and chapters on the video screen; play to the start of the intro; Set start; Set end; add a chapter name; Save; test in Preview as viewer.
- **VW07 Edit captions in detail** (E). Beats: change cue text and times; Find and replace; split and merge; Undo and Redo; Regenerate; Download and Upload a caption file; autosave status.
- **VW08 Add a caption language and publish it** (E, A). Beats: Add translation; choose the language; wait for the draft; review side by side; fix; Approve; switch Publish on (Admin); check the player menu.
- **VW09 Turn captions on or off for one video** (A). Beats: Captions for viewers card; choose On, Off or Follow site default; Off hides the CC button; saved choices of viewers are kept; Save.
- **VW10 Read Analytics** (E, phone). Beats: Analytics; pick a range; tiles compare with the period before; the daily chart; Top titles; Devices, Connection, Countries; small groups show as Other.
- **VW11 See how one video is doing** (E). Beats: open a title from Top titles; views each day; where viewers stop; what that tells you about length and intro.
- **VW12 Make and download a report** (E). Beats: Exports; New export; choose Analytics or Audit; confirm; wait for Ready; Download; very large exports arrive by email link.
- **VW13 Clean up Trash and failed encodes** (E, A). Beats: Trash shows days left; Restore anything wrong; Delete forever is for Admins; Failed encodes: Clean up all; what is removed.

### 4.4 Setup and settings

- **VC01 Platform details and the Launch checklist** (A). Beats: Site settings; the Launch checklist lists what is not set; Platform details: name, tagline, support email, footer, social links; Save; the checklist updates.
- **VC02 Colours, fonts and logo** (A). Beats: Theme; start from a preset; colours; the contrast badge shows pass or fail; fonts; logo and name; preview tabs Home, Watch, Sign in; Save draft; Publish theme.
- **VC03 Go back to an earlier theme** (A). Beats: History; swatches show each version; filter Published or Drafts; Restore; or Reset to default; check the site.
- **VC04 Features and limits** (S). Beats: Features and limits tab; switches such as Open sign up, Kids profiles, My List, Guests can watch; limits such as upload size; read the hint; Save; changes show to viewers quickly.
- **VC05 Home and Discovery settings** (A). Beats: Home tab: auto rotate, seconds per slide, row titles, Trending and Top 10 limits; Discovery tab: search and sharing; synonyms; Save.
- **VC06 Edit the legal and About pages** (A). Beats: Pages tab; choose Terms, Privacy or About; the editor tools; draft banner for placeholder text; Save creates a version; restore a version.
- **VC07 Invite codes for early access** (A). Beats: Invite codes tab (only when sign up is closed); New code with label, uses and expiry; copy the code once; revoke; status words.
- **VC08 Publish an interface language** (E, A). Beats: Languages; each language shows how complete it is; open one; publish above the threshold (Admin); Super admin can override; the language picker appears for viewers.
- **VC09 Translate the site text** (E). Beats: Languages, open a language; the tabs Missing, Stale, In review, Approved, All; type a translation; keep placeholders unchanged; send for review; Export and Import.
- **VC10 Maintenance mode and the notice banner** (A). Beats: Maintenance tab; show a notice banner with a message; Maintenance mode closes the site to viewers; confirm; turn it off again.
- **VC11 Invite a teammate** (S, phone). Beats: Roles and invites; Invite admin form; email and role; Send; pending invites with Resend and Cancel; they follow the link (see Accept your invite).
- **VC12 Change a role, remove access, reset two step** (S). Beats: staff table; change a role (you cannot change your own); the last Super admin is protected; remove access; Reset two step; confirm with your code.
- **VC13 Your own account** (E, phone). Beats: My account in the top bar; Change password; two step and recovery codes; active sessions and sign out others; notification choices.
- **VC14 System** (A, S). Beats: System; Jobs tab: failed jobs, Retry or Discard (Super admin); Storage tab: use by type and the monthly estimate; Player quality: startup, rebuffering, errors.

### 4.5 Money and sponsors

- **VM01 How sponsors and donations work** (E). Beats: sponsors show a thank you message or banner for a period; donations are gifts from viewers through Paystack; both are off until switched on; never shown to kids; where each lives in the menu.
- **VM02 Turn sponsors on** (A). Beats: Sponsors; the master switch; enter your password; confirm; the switch shows On; turn off the same way.
- **VM03 Add a sponsor and its images** (E). Beats: New sponsor; name, start and end day, contact (staff only), notes; Save; add images for each placement; image size hints; Save.
- **VM04 Where a sponsor shows and for how long** (E, A). Beats: placements: home banner, title card, before and after the player; tick where it shows; dates in Lagos time; Activate (Admin); status Live.
- **VM05 Pause, archive or delete a sponsor** (E, A). Beats: status panel; Pause keeps everything; Archive hides it; Delete asks you to confirm and cannot be undone.
- **VM06 Read a sponsor report and print it** (E, A). Beats: open the report; pick a range; impressions and clicks; by image and by placement; daily reach is not added up; Print; CSV for Admins.
- **VM07 Set up donations** (A). Beats: what you set: organisation name, preset amounts, page words, thank you; what the developer sets: Paystack keys; switch donations on in Features; test with a small gift; never paste a key here.
- **VM08 See donations and download the list** (A). Beats: Donations; totals; filter by status and date; open a gift; masked emails; Export CSV.
- **VM09 Settle a gift that needs review** (A). Beats: a gift flagged Needs review; open it; Reveal donor email (this is recorded in the audit log); read the note; choose how to settle; add a note; confirm.

### 4.6 Safety and kids

- **VK01 Make a video safe for Kids mode** (E). Beats: suitability on the video screen; choose Kids safe only when a grown-up would be happy for a child to watch alone; Kids profiles see only these; sponsors and donate never show to kids.
- **VK02 Maturity ratings** (E, A). Beats: rating on the video; the labels in Features and limits; the highest rating guests can see; why a title may be hidden from guests.
- **VK03 Let visitors watch without an account** (A, S). Beats: Guests can watch switch; the default audience General or Kids; guests keep progress on their device only; what guests cannot do.
- **VK04 Suspend an account and sign someone out everywhere** (A, phone). Beats: Users; search; open the account; Suspend account with a reason; Sign out everywhere; how to undo a suspension.
- **VK05 Reset a viewer's two step sign in and delete an account** (A, S). Beats: when to reset (lost phone and codes); Reset two step; confirm; Delete account is Super admin only, needs the owner's request, typed confirmation, and cannot be undone.
- **VK06 Read the audit log** (A, S). Beats: Audit log; filter by person, action, date; open a row for before and after; Admins see content actions; Super admin sees all and can export.
- **VK07 Keep the admin safe** (E). Beats: a long unique password; two step always on; never share your account; sign out on shared devices; the session warning; what to do if you think someone else has your password.

### 4.7 Troubleshooting

- **VT01 A video is stuck on Encoding** (E, phone). Beats: Encoding queue; is it moving; large files take longer; Retry if Failed; read the plain reason; what to send the developer (T11).
- **VT02 A video will not publish** (E, phone). Beats: Publish is greyed; open the checklist; each red item has a fix: poster, details, captions approved, encoding finished; fix and try again.
- **VT03 Captions are missing or wrong** (E). Beats: check the state in Captions; Generating, Needs review or Failed; Regenerate; edit; check the video's captions switch; check the language.
- **VT04 Viewers say a video will not play** (E). Beats: is it Published; is it still Encoding; try Preview as viewer; try another browser; read the reference code the viewer sees; send it to the developer.
- **VT05 An upload keeps failing** (E). Beats: check file type and size limit; check your connection; Retry; try one file alone; big files on mobile data; send the reference code.
- **VT06 I cannot sign in or I lost my phone** (E, phone). Beats: wrong password message is the same for all; account locked for 30 minutes; use a recovery code; lost both: ask a Super admin to reset two step.
- **VT07 I changed something by mistake** (E). Beats: bulk results have Undo for a short time; Trash restores videos for 30 days; Theme history restores looks; Pages keep versions; Home has Restore launch layout.
- **VT08 The site looks wrong after a theme change** (A). Beats: open Theme history; Restore the last good one; or Reset to default; check contrast badges before you publish next time.
- **VT09 A donation is missing or still pending** (A). Beats: Donations; filter Pending; give Paystack a few minutes; open the gift; Needs review means we could not confirm it; settle only with proof from Paystack.
- **VT10 Storage is nearly full** (A). Beats: System, Storage; where space goes; empty Trash; clean up Failed encodes; ask the developer to raise the cap.

### 4.8 Playlists on the help home

The seven paths are the playlists. Each path page offers "Play all in order" (the page plays the next video after the end card, never autoplays on load, off under reduced motion). A single "Full course" playlist lists all 73 in path order for a person who wants to learn everything.

## 5. Article template and caption style guide

### 5.1 Article template

Each article is one Markdown file `content/help/en/<path>/<id>-<slug>.md`, front matter plus six fixed sections. Section titles are fixed so people learn where to look.

Front matter fields: `id`, `title`, `path`, `summary` (one sentence, under 20 words), `role` (editor, admin, super_admin), `roleNote` (for mixed tasks), `needs` (ids), `related` (ids), `readMinutes`, `watchSeconds`, `video` (id, desktop and phone files), `screens` (route patterns it explains, used for the Help link), `actions` (ids from `can.ts` it depends on), `aliases` (search words), `flow` (flow file id), `dependsOn` (source paths for impact checks), `verifiedAgainst` (release tag and short sha), `locale` (`en`), `status` (draft, reviewed, verified).

Sections in order:

1. Video (the player, with the transcript below it).
2. What you will do (one sentence and the result).
3. Before you start (role, things to have, earlier articles).
4. Steps (numbered, one action each, each with an optional picture).
5. What you should see (the end state, with a picture).
6. If something goes wrong (up to three causes, each with one fix, and a link to the matching T article), then Related and Next.

Example skeleton (shortened) for D02:

```
id: D02
title: Upload one video
path: daily
summary: Add a video file so you can prepare and publish it.
role: editor
needs: [S04]
related: [D03, D04, D05]
readMinutes: 4
screens: ["/admin/videos/upload"]
actions: [video.upload]
flow: D02
verifiedAgainst: v1.0.0 (abc1234)

Steps
1. Click Upload in the side menu.
2. Drag your video onto the box, or click the box and choose a file.
3. Wait until the row says Done. Keep this page open.
4. Click Edit details to add the title.
```

### 5.2 Writing rules (apply the design system rules, `docs/DESIGN-SYSTEM.md` section 14)

- Plain English a secondary school student can read. Short sentences, under 20 words. Active voice, "you".
- One action per step. A step starts with a verb: Click, Type, Choose, Tick, Drag, Wait, Check. No "and then", no two clicks in one step.
- Say where: "Click Upload in the side menu", "Open the Captions tab at the top". Quote labels exactly as on screen, in bold in articles, with the same capitals. Labels are verified against the live screen by the fact checker and by the label check (section 12.2).
- Say what you will see after a step when it matters ("The row turns green and says Done").
- Say who can do it ("Admins and Super admins only") with the generated "Who can do this" line.
- No dashes of any kind (use a comma, a full stop or "to"), no emojis, no exclamation marks, sentence case, no ALL CAPS, no jargon. Use "video quality" not bitrate, "captions" not WebVTT, "get ready" not transcode. Numbers as "4 min", dates as "17 Nov 2026", money with the naira sign, data in MB.
- Use the product words, not synonyms: Videos, Series, Categories, Home curation, Captions, Encoding, Trash, Theme, Roles and invites. Plain aliases live in search only.
- Warnings say what happens and how to undo: "This cannot be undone" only when true.
- Names, domains, colours and any client text in examples come from the demo dataset (section 11), never real people.
- The glossary (R01) defines each hard word once: poster, encode, caption, cue, series, season, episode, section, hero, placement, sponsor, donation, master switch, role, two step sign in, recovery code, session, audit log, Trash, draft, scheduled, kids safe. Articles link the first use.
- Reading level target: about grade 7, checked with a script (average sentence length and long word count) as a warning, not a gate.

### 5.3 Caption style guide (burned in captions)

| Rule | Value |
|---|---|
| Lines per caption | 1 or 2, 42 characters per line at most |
| Time on screen | 2 to 6 seconds, at most 15 characters per second |
| One caption | One action or one idea, starting with a verb for actions |
| Labels | Exactly as on screen, set in bold weight so the eye matches them |
| Position | Bottom third by default; the flow sets `top` when the action is in the bottom third |
| Look | White text on a solid dark panel (contrast at least 7 to 1), font size at least 28 px at 1280 wide, sans serif from the design system list |
| Step badge | Small "Step 3 of 7" badge in a fixed corner |
| Pointer | Visible cursor with a click ring, moves in 600 ms, never jumps |
| Typing | About 60 ms per character |
| Waits | Dead time over 1.5 seconds is cut; a long wait (encoding) is skipped with a "Time skipped" badge |
| Title card | 3 s: title, "For Editors" style line, length |
| End card | 3 s: "Next: D03 Upload many videos", the article id |
| Language | English first; captions are data (section 16) |
| Flashing | Nothing flashes more than 3 times a second; no screen shake or zoom pulses |

### 5.4 Review gates per item

Every article and video passes the same definition of done: copy lint clean (no dashes, no emojis, no banned words), label check clean, the flow runs green as the right role, the fact checker followed the article from a clean demo stack using only the article, the design system reviewer passed the page and the caption look, screenshots pass the standards in section 6, accessibility checks pass, and the video is within its length.

## 6. Screenshot standards

### 6.1 Capture

- Desktop: viewport 1280 by 800, device scale 2, saved at 1280 px wide as WebP. Phone: viewport 390 by 844, device scale 3, saved at 390 px wide as WebP. Both use the page viewport only, so no browser chrome, tabs or address bar are ever captured.
- Light theme. The admin has one look (a dark side menu and light content). Dark captures are taken only for screens that are dark by design: the admin sign in card and the preview player. There is no admin night mode today (R27: Night preset is a Could), so "light and dark" in the brief means these dark by design screens. If a Night preset ships later, the pipeline adds `--scheme dark` as a flag with no change to flows.
- Each shot is named in the flow (`shot: 'upload-queue'`) and written to `content/help/media/<id>/<id>-<nn>-<name>-<desktop|mobile>.webp`.
- Size budget: at most 120 KB per image, at most 40 MB for all, enforced by a check.
- Time frozen to a fixed Lagos date and time, animations disabled for the capture, fonts loaded, caret hidden, scrollbars hidden.

### 6.2 Annotation (drawn by the recorder, not by hand, so it repeats)

- Numbered badge: 28 px circle, dark ink fill, white number, matches the step number in the article.
- Highlight: 3 px rounded outline in the annotation yellow with a 1 px dark halo so it shows on light and dark. Annotation colours are fixed values for the KB and are not theme tokens, because they must not change when the client changes the theme.
- Crop: a shot is a full viewport or a tight crop of one card, never a part of a card that cuts text.
- Dim: optional 20 percent dim outside the highlighted area for focus.
- No arrows. Numbers and the step text carry meaning.
- Every image has alt text written from the step ("The Upload page with the drop box marked 1"), and the same text is in the printed copy.

### 6.3 Redaction and fakeness

The recording stack holds only demo data (section 11), so there is nothing real to redact. As a second line the capture step scans the page text and fails if it finds an email not ending in `@kb-demo.example`, a string that looks like a token or key (`sk_`, `pk_`, long base64, JWT shape), an IP address that is not documentation range, or any text on the denylist. Elements marked `data-kb-mask` (for example a QR code or a recovery code) are replaced by a clearly fake placeholder before capture. Image metadata is stripped. A visible "Demo data" corner is not drawn on every picture; instead all demo titles, names and sponsors are plainly fake (section 11.2).

### 6.4 Mobile and desktop pairs

Every article has desktop shots. The 16 phone articles also have a phone set, shown with a Phone and Desktop toggle in the article (remembered per person). On a phone the article defaults to Phone when a phone set exists. The admin is built for md and up with a reduced sm layout (SCREEN-ARCHITECTURE section 2), so phone shots show the real reduced layout: drawer menu, stacked cards.

### 6.5 Count

About 75 task articles times 5 desktop shots, plus 16 phone articles times 4 shots, gives about 440. Allow 60 more for the reference articles and troubleshooting. Planning figure: about 500 images, about 40 MB.

## 7. Where the knowledge base lives

### 7.1 Recommendation

Put it inside the admin at `/admin/help`, with a Help link on every admin page and a contextual help button in the top bar. Do not build a separate public site now. Host the videos as static, silent, captioned MP4 files in private object storage, served only to signed in staff through an authenticated route. Do not publish them as catalog titles.

### 7.2 Inside the admin versus a separate public site

| Question | Inside `/admin/help` (recommended) | Separate public site |
|---|---|---|
| Who can read it | Signed in staff only | Anyone with the link, including search engines |
| Reveals admin screens and roles to attackers | No | Yes: screenshots and steps map the admin and the demo accounts |
| Context | Help link and panel know the current screen and role | Cannot know the screen or role |
| Stays in step with the product | Same repo, same release, same CI | A second deploy that drifts |
| Extra hosting, domain, TLS, cost | None | A host, a domain, DNS and upkeep for the client |
| Works when the public site is in maintenance | Yes | Yes |
| Share with a new volunteer before they have an account | Needs an account (or the offline handbook) | Easy |
| Find it from a search engine | No, by design | Yes |

Reasons for the recommendation: it teaches by role and by screen, it keeps the admin map private, it ships and is versioned with the product, it adds no hosting for the client, and the one weakness (no account yet) is covered by the offline handbook (section 9) and the invite email.

### 7.3 In product entry points

- Top bar: a Help button (question mark icon, text "Help" at md and up) beside the notice bell. It opens a panel: a side drawer at md and up, a bottom sheet on phones. The panel shows the article that matches the current route (from `screens` front matter), the video, and "Open full article". If no article matches it shows search and the core tasks.
- Page header: a "Help" link in `PageHeader` next to the actions, linking `/admin/help/<id>` for the route. The route to article map is generated from front matter into `apps/web/src/lib/admin/help-map.ts`.
- Risky settings (Features and limits, Maintenance mode, sponsor master switch, Delete account, Reset two step): a "Learn more" link beside the control to the exact article section.
- Dashboard: the existing Start here card links to S06. Empty states can add a help link where useful.
- Side menu: a Help item at the bottom of the menu (visible to all staff), so a person on a phone finds it in the drawer.
- Keyboard: the slash key focuses search on the help pages, a question mark key opens the panel (not while typing in a field).

### 7.4 Access and indexing

`/admin/help/**` uses the same session guard as the rest of `/admin` (`admin.access`, Editor). Every article is visible to every staff role. An article for a higher role shows an "Admin only" or "Super admin only" label and does not hide, so an Editor can learn what to ask for (decision D-359). Responses carry `X-Robots-Tag: noindex`, `/admin` stays in `robots.txt` disallow and out of the sitemap, and the media route sends `Cache-Control: private`.

### 7.5 How the videos are hosted

| Question | A. Catalog titles (draft or hidden) | B. Platform pipeline with a staff only flag | C. Static files in private storage (recommended) |
|---|---|---|---|
| How | Upload through the Videos screen, keep unpublished, in a hidden category | Same encode worker, a new `staff_only` marker on the video row, new exclusion everywhere | Build step encodes MP4 and WebVTT, copies to `help/<release>/` in storage, an authenticated route serves them |
| Viewer catalog, Home rows, search, sitemap | Risk: one publish click exposes a staff tutorial to every viewer | Excluded by a predicate that every catalog query must honour (new migration, many call sites, easy to miss one) | Not in the catalog at all, by construction |
| Kids and guests | Risk of showing admin screens on a kids profile | Needs kids and guest exclusion tests per query | None, never reachable |
| Analytics and counts | Pollutes viewer analytics, Top titles, Trending, Top 10 | Needs exclusion in every aggregate | None, no events written |
| Videos list, Trash, bulk actions, Encoding queue | 73 extra rows in the list the team uses daily | Hidden by the same flag, more filters | None |
| Storage and encode cost | HLS ladders, keys, previews, poster jobs for silent screen recordings | Same | One small MP4 (about 1 MB a minute at 720p) plus a 480p copy |
| Works offline in the handbook | No | No | Yes, plain files |
| Re-recording after a screen change | Re-upload by hand, re-publish | Re-upload through a new path | `pnpm kb:record` writes new files, release switch moves the pointer |
| Player | The viewer player with playback sessions and tokens | Same | Native `video` element with poster, captions already burned in, chapters track optional |
| Schema change | None | Migration plus exclusion changes in many packages | None |
| Main downside | Dangerous and noisy | Big blast radius for a help feature | No adaptive bitrate (mitigated by two sizes and a Data saver default) |

Detail for C: files `help/<release>/<id>/<id>-720.mp4`, `-480.mp4`, `-poster.webp`, `-captions.vtt` (the transcript source, not rendered as a second caption track), `-phone-720.mp4` where a phone version exists. H.264, no audio track, faststart, keyframe every 2 s, 25 fps. Served by `/admin/help/media/[...path]` after the session check, either streaming with Range support or redirecting to a short lived signed URL using the same helper as staff export downloads (verify at build in `@ad/storage`). The page picks 480p when the browser reports Data saver or the screen is under 600 px wide, otherwise 720p, with a Quality choice. Keep the current and the previous release in storage and delete older ones with a script. Planning size: 73 videos at 2 min 50 s average is about 3 hours 26 min, about 240 MB at 720p plus about 120 MB at 480p, plus phone versions, so about 450 MB per release.

Upgrade path: if the client later wants help videos inside the platform pipeline (option B), the flow files and captions are unchanged and only the publish step differs. Logged as decision D-360.

## 8. Search inside the knowledge base

- Index built at build time into one JSON file: id, title, summary, headings, step text, aliases, path, role. A small tokenizer and scorer, no server call, works offline in the handbook. Check the lockfile first: no search or markdown library is installed today, so adding one is a small logged decision, or write a 150 line scorer in a new `packages/help` module.
- Ranking: exact title and id match first, then title words, aliases, headings, step text. Role boost: results the person can do rank above results for a higher role, which still show with a label.
- Aliases and plural forms (section 3.11), simple stemming, typo tolerance of one edit for words of 5 letters or more, "Did you mean" line.
- Results show a title, a one line summary, the path, the role label and a watch time. Keyboard: slash to focus, arrow keys to move, enter to open, escape to clear.
- No results: one headline, one sentence ("Try a shorter word, or browse the paths"), one action (Browse all articles). Empty search box shows recent articles from this browser only and the 12 core tasks.
- Searches are not stored on the server and not counted (privacy, section 14).

## 9. Offline copy, print and PDF

- Print: every article has a print stylesheet. Chrome, menus and the video player are hidden. Steps print in full with their pictures at full width, the "Who can do this" line, and a line "Watch the video: Help centre, article D02". Links print as text with the article id. Page breaks avoid cutting a step or picture. 44 px targets do not matter in print, but type is at least 11 pt.
- Save as PDF per article: a Download PDF button using the browser print dialog first (zero build cost), and a prebuilt PDF per article produced at release by Playwright `page.pdf` into `help/<release>/pdf/<id>.pdf` for people who want a file.
- Whole handbook: one PDF per path and one for everything, built at release.
- Offline handbook: a ZIP of static HTML (relative links, the search index, CSS inlined, screenshots), about 40 MB without videos and about 450 MB with. The default download has no videos with an optional "with videos" link. It opens from a laptop or a phone with no server. A banner says which release it matches. It is the answer for a new volunteer with no account yet and for a bad connection.
- No service worker caching of admin pages. The existing service worker is for the viewer app (PWA), and caching authenticated admin screens on shared devices is a risk, so offline is a download, not a cache (decision D-359).

## 10. Content as code, versioning and freshness

### 10.1 One source of truth

A procedure is defined once, as a flow. The flow produces the video, the screenshots, the step list in the article and the proof that the steps work. This is what stops text, video and pictures drifting apart.

### 10.2 The flow file

`content/help/flows/<id>.flow.ts`, a typed list of steps. Sketch:

```ts
export default defineFlow({
  id: 'D02',
  role: 'editor',
  start: '/admin',
  viewports: ['desktop', 'mobile'],
  steps: [
    { id: 'menu', say: 'Click Upload in the side menu.', do: click.nav('Upload'), shot: 'menu' },
    { id: 'drop', say: 'Drag your video onto the box.', do: upload('demo/lesson-01.mp4'), shot: 'queue' },
    { id: 'done', say: 'Wait until the row says Done.', do: waitFor.text('Done'), expect: visible.text('Done') },
  ],
});
```

Every step has an `id`, a `say` line (burned in caption and article step), a `do` action (built from a small set of helpers that find controls by role and visible label, never by CSS), optional `shot`, optional `expect` (the proof), optional `caption: 'top'`, optional `skipTime`. The article embeds the steps with `<Steps flow="D02" />`, so the step text is written once.

### 10.3 Versioning

- Content lives in the repo: `content/help/en/**` (Markdown), `content/help/flows/**`, `content/help/media/**` (screenshots, committed), `content/help/seed/**` (demo dataset definition). Videos and PDFs are build outputs, not committed, stored in object storage per release.
- Each article records `verifiedAgainst` (release tag and sha). The page footer shows "Checked against release v1.0.0, 25 Nov 2026".
- `dependsOn` lists the source paths a procedure relies on (the screen components, `nav.ts`, `can.ts`, the settings registry). A script maps changed files to affected articles.
- Release flow: tag, run the full recording on the demo stack, publish media to `help/<release>/`, flip a pointer setting `help.mediaRelease`, keep the previous release for rollback.
- `R08 What is new` lists admin changes per release, written from `CHANGELOG.md`.

### 10.4 Repeatable script

| Command | What it does |
|---|---|
| `pnpm kb:stack` | Starts the isolated demo stack and seeds it |
| `pnpm kb:seed` | Resets and seeds the demo dataset (section 11) |
| `pnpm kb:verify [--only D02] [--changed]` | Runs flows without recording, checks every step and `expect` as the right role |
| `pnpm kb:shots [--only D02]` | Captures and annotates screenshots |
| `pnpm kb:record [--only D02] [--phone]` | Records, adds captions, encodes MP4 and VTT |
| `pnpm kb:build` | Builds the article pages, search index, print CSS, PDFs and the offline ZIP |
| `pnpm kb:check` | Runs the lint, coverage, label, size and fakeness checks |
| `pnpm kb:publish` | Uploads media to `help/<release>/` and flips the pointer |
| `pnpm kb:update D02` | Re-records one article and rewrites its screenshots for review |

Only the scoped test commands from `CLAUDE.md` run in CI for code; `kb:*` commands are their own jobs.

### 10.5 CI checks that fail when a recorded screen no longer matches

Two tiers, so pull requests stay fast.

- On every pull request that touches `apps/web/src/app/admin/**`, `apps/web/src/components/admin/**`, `nav.ts`, `can.ts` or the settings registry: `pnpm kb:verify --changed` runs only the flows whose `dependsOn` match, headless, no video, with waits trimmed. It fails if a step cannot find its control by role and label, an `expect` fails, or the label text in the article no longer exists on the screen. The failure message names the article, the step and the new label, and attaches the screenshot. Expected cost: a few minutes.
- Nightly and on release tags: the full run, which also compares each screenshot to its committed baseline with a perceptual diff (changed pixels under 0.5 percent after masking dynamic areas) and rebuilds all videos. A changed screen is a failure with the diff image attached. The fix is `pnpm kb:update <id>` and a reviewed commit.
- Always (fast, static, part of the scoped test set): coverage tests (section 12.3), copy lint, size budgets, fakeness scan, front matter schema, link check, every `screens` route exists, no article without a flow unless marked text only.

### 10.6 Keeping it from rotting

An article whose `dependsOn` files changed after its `verifiedAgainst` and was not re-verified gets a CI warning in the pull request and shows in a `kb:status` report (stale, never verified, verified). A product change that adds a route, a nav item, a permission or a setting fails the coverage tests until a KB entry exists, which is the forcing function.

## 11. Demo dataset, accounts and the recording stack

### 11.1 Isolation

Recording and fact checking run only against a separate stack: its own databases (`ad_kb`, `ad_kb_keys`), local storage driver, no real Paystack keys (a fake Paystack adapter exists in `@ad/payments`), mail sent to a capture sink, `APP_ORIGIN` of `http://localhost` or a `.invalid` host. The recorder refuses to start unless the origin and database names match the allow list, and never reads `.env` files of staging or production. Real admin accounts are never used.

### 11.2 What the demo data looks like (clearly fake, never real)

| Thing | Demo rule |
|---|---|
| Staff accounts | `editor@kb-demo.example`, `admin@kb-demo.example`, `owner@kb-demo.example`, names "Demo Editor", "Demo Admin", "Demo Owner", passwords generated per run and never printed in a shot |
| Viewers | "Demo Viewer 01" to "Demo Viewer 20", emails `@kb-demo.example` |
| Videos | About 24 short lessons titled with a "Demo lesson:" prefix on topics like saving data, school tips, plus 2 series ("Demo series: Learn to budget") with 2 seasons |
| Artwork | Flat colour tiles generated by the seed with the word DEMO; no real photos or logos |
| Sponsors | "Demo Sponsor Ltd", "Demo Bakery", placeholder images marked DEMO |
| Donations | "Demo Donor 01" to "Demo Donor 12", round amounts, a few in each status, one needing review |
| Platform name | The demo stack uses the current platform name setting. A final re-record happens at handover (section 16, decision D-363) |
| Two step | Throwaway secret and fake recovery codes for the enrolment recordings |
| Dates | Fixed to a plausible Lagos date; relative dates never read "today" in a way that goes stale |
| Source video | One synthetic test clip family made by `scripts/make-sample-hls.sh` style tooling, no real footage |

### 11.3 Harness requirements (confirm with the feasibility spike)

Playwright with video recording of the page viewport at 1280 by 720 (and 390 by 844), a controlled clock, reduced motion off for natural movement, a cursor overlay and click ring injected by the harness, caption and step badge overlay drawn in the page for the capture then burned in by ffmpeg from the VTT (alternative if the spike prefers: render captions in-page), trimming of dead time, speed up of long waits with the badge, encode to H.264 with `-an`, poster frame extraction, VTT export. The existing Playwright setup (`apps/web/playwright.config.ts`, projects `mobile` 360 by 740 and `desktop`) is reused for config and fixtures. Open items for the spike: smooth cursor motion fidelity, caption burn in method, headless Chromium video quality at 25 fps, total record time (target: the whole playlist under 90 minutes of machine time on CI), flakiness controls. If the spike disagrees with any detail here, the spike wins and this plan is amended.

## 12. Accessibility, responsive layout and quality gates

### 12.1 Accessibility

- Videos: captions are burned in and always visible; the same text is a transcript under every video ("Read this video"), including what the pointer does ("The pointer moves to Upload"), so a screen reader user gets the whole procedure. No audio, so no audio description is needed.
- Native `video` controls (keyboard operable, speed control), no autoplay, no looping, `playsinline`, a poster. Reduced motion: no auto advance to the next video, no animated transitions on the help pages. Recordings contain no flashing and no large zoom effects.
- Articles: one `h1`, ordered headings, skip link to the steps, steps as an ordered list, alt text on every image, text contrast at least 4.5 to 1 (7 to 1 on burned in captions), visible focus ring from tokens, 44 px targets, works at 200 percent zoom and with forced colours, language attribute `en`.
- Tabs, the Phone and Desktop toggle and the lightbox follow the tab and dialog patterns already in the admin (`Tabs.tsx`, `Dialog.tsx`).
- Automated: axe checks on the help home, an article, search results and the panel, at desktop and phone width, in the scoped e2e for this module.

### 12.2 Responsive layout (mobile friendly and desktop friendly)

Uses the breakpoints in `docs/SCREEN-ARCHITECTURE.md` section 2 and only tokens from `@ad/ui/tokens.css` (no hardcoded colours or fonts).

| Width | Layout |
|---|---|
| base, under 600 | One column. Search first, then paths as stacked cards. Article: video at the top, then a sticky "Steps" mini bar, then text. Path list opens as a bottom sheet. Tables become stacked cards. Images fit the width, tap to open a pinch zoom lightbox. Phone video set preferred. |
| sm, 600 to 959 | One column with wider measure (up to 72 characters), two column path cards. Panel is a bottom sheet. |
| md, 960 to 1279 | Two columns: path or article list (about 260 px) and the article. Contextual help is a side drawer. "On this page" is a dropdown. |
| lg and xl, 1280 and up | Three columns: path tree, article (max 72 characters), on this page and related. Video sits above the steps, sticky Picture in picture is not used. |

Rules: no horizontal page scroll at any width, 44 px targets, the video is 16:9 on desktop and portrait on phone when a phone recording exists, never a fixed pixel width, text never smaller than 16 px, reading column never wider than 72 characters, print layout is separate (section 9). The help pages are checked at 360, 600, 960 and 1280 wide in the layout e2e, like `apps/web/e2e/admin-l3-layout.e2e.ts`.

### 12.3 Coverage and truth tests (the part that keeps it complete)

| Test | Fails when |
|---|---|
| Route coverage | An admin `page.tsx` route has no article `screens` entry |
| Nav coverage | A `NAV_ITEMS` href has no article |
| Permission coverage | An action in `can.ts` is missing from R02, or a "Who can do this" line disagrees with `can.ts` |
| Settings coverage | A settings registry key is missing from R04 |
| Status coverage | An enum value in `VIDEO_STATUSES`, `PUBLISH_STATES` or `CAPTION_STATUSES` is missing from R06 |
| Flow proof | A step cannot find its control, or an `expect` fails |
| Label check | A label quoted in an article is not on the live screen |
| Copy lint | A dash, an emoji, a banned word (jargon list), a sentence over 25 words in a step |
| Media budget | An image over 120 KB, a video over its length or size limit |
| Fakeness | Real looking data in a capture (section 6.3) |
| Link check | A related or next link points nowhere |

## 13. Translation

English first (R23 is about the viewer interface, not this). Content is already organised by locale (`content/help/en`), the front matter has `locale`, and the page falls back to English per article. Because captions are data (`say` lines in a flow) a translated playlist is a re-render, not a re-record of the procedure. The admin interface itself is English only today (the viewer catalogs from M46 do not cover the admin), so a translated help centre would explain screens whose labels stay English. Decision D-365: English only until the owner asks, with Pidgin first if asked, and labels always quoted in English.

## 14. Privacy and security

### 14.1 Data

Recordings and screenshots come only from the demo stack (section 11). No production or staging data, no real emails, no real tokens. The recorder allow list, the capture scanner, metadata stripping, `scripts/secret-scan.sh` over `content/help`, and review by the copy reviewer make a leak a failed check, not a judgement call. Browsers used for recording are fresh profiles with no extensions, no saved logins, and notifications off.

### 14.2 Access

Help pages and media sit behind staff sign in. They contain no secrets: they explain screens, they never print a real URL for the real site with tokens, and they never show a recovery code or a key. Articles about secrets (Paystack keys, server secrets) say who sets them and never show an example key (M07, T11).

### 14.3 What the help centre records

Nothing about people. No analytics events, no search logging, no article view counts. A "Tell us what is unclear" link opens the support email (setting) with the article id filled in. Aggregate feedback counting can be considered later (Could, M50-S24).

### 14.4 The 12 core tasks for the Vanessa test

Sign in, upload a video, add title and categories, approve captions, publish, schedule, unpublish and restore from Trash, add a series episode, arrange a Home row, change the platform tagline, invite a teammate, read the Dashboard and Analytics. Done with only the KB, on the demo stack, by a person who has not used the admin.

## 15. Content production pipeline

### 15.1 Volumes and rough totals

83 articles, 73 desktop videos and 16 phone videos, about 500 screenshots. Video runtime about 3 hours 26 min for the desktop set (sum computed from the Watch column in section 3 and re-computed in `kb:status`), reading time about 4.5 hours of text.

### 15.2 Lanes and agent roles

| Lane | Agent role | Input | Output | Gate |
|---|---|---|---|---|
| K0 | Platform builder | This plan | `packages/help`, `/admin/help` pages, route and map, nav entry, header link, panel | Scoped tests, design review |
| K1 | Harness builder | Spike result | Demo seed, isolated stack, flow runner, recorder, caption burn in, screenshot annotator, encoder, `kb:*` commands | Pilot flows pass |
| K2 | Script writer (one per path) | Route table, code, user stories | Flow files with `say` lines and `expect`s, plus the article prose | Copy lint, flow schema |
| K3 | Recorder | Flows | Videos and phone videos, posters | Length and size checks |
| K4 | Caption maker | Flows | Timed cues, VTT, transcript text | Caption rules (section 5.3) |
| K5 | Screenshot annotator | Shots | Annotated WebP with alt text | Standards (section 6) |
| K6 | Copy reviewer | Articles and captions | Edits to meet section 5.2 | Copy lint clean, human read |
| K7 | Design system reviewer | Help UI, caption look, annotations | Review notes using the `angels-delight-design-system` skill | Pass on tokens, contrast, states, keyboard, reduced motion, touch targets, mobile first |
| K8 | Fact checker | Only the published article text, a clean demo stack, the right role account | Pass or a list of steps that did not work | Every procedure re-run by following the words, not the flow |
| K9 | Integrator | All lanes | PRs, release, `kb:status` report, handbook | Coverage tests green |

K8 is independent on purpose: it is given the article only (not the flow) and must complete the task, so a missing step or a wrong label in the text fails. Each path ships as a checkpointed batch (its own pull request) so progress is saved and a rate limit costs at most one batch.

### 15.3 Per item flow

Script (K2) then verify (flow runs green) then record and shoot (K3, K5) then captions (K4) then copy review (K6) then design review (K7) then fact check (K8) then merge. A change request re-enters at K2.

## 16. Delivery plan

### 16.1 Slices

Sizes: S about 1 agent day, M about 2 to 3, L about 4 to 6. One PR per slice at least.

| Slice | Contents | Acceptance | Size | Risk |
|---|---|---|---|---|
| P0 | This plan approved | Owner approves or amends | S | Low |
| L14-01 Foundations | `packages/help` (front matter schema, Markdown loader, index builder), `/admin/help` home, path, article and 404 pages, role labels, side menu Help item, header Help link and `help-map.ts`, three placeholder articles | Pages render at 4 widths, deep link works, axe clean, coverage tests exist and fail on the missing articles | M | Low |
| L14-02 Help panel, search, print | Contextual panel (drawer and sheet), search with aliases, print stylesheet, per article PDF button, Phone and Desktop toggle | Search finds the core 12 in the first 3 results, panel matches 41 routes, print preview clean | M | Low |
| L14-03 Harness | Demo seed and `kb:stack`, flow runner with role login, annotator, caption burn in, encoder, fakeness scanner, `kb:*` commands, 3 pilot flows (S04, D02, D07) | Pilot videos 1 to 4 minutes, captions readable, flows pass as Editor, no real data, phone and desktop both work | L | Medium (recording quality, flakiness) |
| L14-04 Media route and player | Authenticated media route with Range, video component with transcript and quality choice, storage layout, `kb:publish` | Staff can play, a viewer or anonymous gets 401 or 404, no catalog row, no analytics event | M | Low |
| L14-05 Start here | S01 to S08 | Fact checker passes each, Vanessa test tasks 1 | M | Low |
| L14-06 Daily | D01 to D12 | Same gates | L | Medium |
| L14-07 Weekly | W01 to W13 | Same gates | L | Medium (Home, captions screens are busy) |
| L14-08 Setup | C01 to C14 | Same gates, theme and languages recordings stable | L | Medium |
| L14-09 Money and safety | M01 to M09, K01 to K08 | Same gates, demo donations and sponsors clearly fake | L | Medium |
| L14-10 Troubleshooting and reference | T01 to T11, R01 to R08 with generated R02, R03, R04, R06 | Coverage tests green | M | Low |
| L14-11 Freshness and handover | Impact map and `kb:verify --changed` in CI, nightly full run, handbook PDFs and offline ZIP, Help item in `docs/LAUNCH-RUNBOOK.md` (record again with the client's name and theme at handover), the Vanessa test | CI fails when a label changes, Vanessa test 12 of 12 | M | Medium |

Order: L14-01 and L14-03 can run in parallel after approval, L14-02 and L14-04 after 01, content slices after 03 and 04 with L14-05 first to prove the loop. Content paths 06 to 10 can run as parallel batches.

### 16.2 Effort

About 30 to 36 agent days in total: platform 8 to 10, harness 5 to 6, content 15 to 18 (about 83 articles, 89 recordings, 500 images), freshness and handover 3. About 14 to 18 pull requests. Machine time per full re-record: about 90 minutes.

### 16.3 Risks

| Risk | Impact | Mitigation |
|---|---|---|
| Admin screens change while the content is made (busy lanes) | Rework | Flows are the source, `kb:verify --changed` finds breakage, content slices start after the admin is quiet |
| Recording quality or flakiness in headless Chromium | Poor videos | Spike first, pilot slice, fixed clock, trimmed waits, retries per step |
| Demo data leaks into reality or the other way | Privacy | Isolation, allow list, scanner, fake domain |
| A permission differs between docs and code | Wrong help | Code is truth, generated role lines, fact check with the real role account (finding F1 and F2 below) |
| Phone admin is a reduced layout | Phone recordings look cramped | Only 16 phone recordings, chosen where it works |
| Volume (83 articles) overwhelms a non technical reader | Not read | Seven paths, 12 core tasks, Start here first, search, short videos |
| The client renames the platform or recolours it after recording | Videos look out of date | Re-record at handover (one command), flows are unchanged |
| Large media in git | Repo bloat | Videos are build outputs in storage, only WebP screenshots are committed under a budget |
| New markdown or search dependency | Footprint | Check lockfile, prefer a tiny local scorer, log it |
| Burned in captions cannot be resized | Hard to read on a small phone | 28 px at 1280 and 22 px at 390 floor, phone recordings use their own layout |

### 16.4 Findings from this pass

- F1: `SCREEN-ARCHITECTURE.md` 3.3 uses an "Analyst" role and says System is Super admin only. The code has no Analyst and lets an Admin view System (`system.view` is Admin, `system.jobs` is Super admin). Follow the code, reconcile the doc in L14-01.
- F2: `SECURITY.md` section 5 says retrying failed encodes is Admin and up, but `can.ts` has `encode.retry` at Editor. The KB follows the code; the fact checker confirms with an Editor account; reconcile the document that is wrong.
- F3: `NAV_ITEMS` has 20 items, but `SEGMENT_LABELS` in the breadcrumb helper has no entries for languages or donations, so breadcrumbs may fall back to raw text there (verify at build; not a KB task, noted for the admin owner).

## 17. Open questions, answered with the recommended default

| Question | Default taken |
|---|---|
| Inside the admin or a public site | Inside `/admin/help` (D-359) |
| Should Editors see articles for higher roles | Yes, labelled (D-359) |
| Host videos as catalog titles | No, static private files (D-360) |
| Content format and where | Markdown, flows and WebP in the repo, video as release artifacts (D-361) |
| Which data and accounts for recording | Isolated demo stack, fake `@kb-demo.example` accounts (D-362) |
| Captions as a track or burned in | Burned in plus transcript text and VTT (D-363) |
| Freshness checks | Two tier CI and a nightly full run (D-364) |
| Languages and roles wording | English only, code roles (D-365) |
| Voice over | None, ever, per the request |
| Music | None |
| Include the viewer side guide | No, `/help` already exists for viewers |
| Show Paystack key entry | No: keys are set by the developer on the server (CLIENT-INPUTS section 6); the article shows only what the client sets |
| Offline handbook with videos | Optional download, off by default |
| Usage analytics for help | None in this phase |
| Feedback | A "Tell us what is unclear" link to the support email |
| Who maintains | ARKDEV, enforced by CI; update at every release |
| Re-record with the client's final name and theme | Yes at handover, once client inputs land |

## 18. Mockups needed (drawn by the mockup agent in `docs/mockups/v2/L14`, numbers assigned there, S200 to S209 suggested)

Help home (desktop and phone), path page, article page (desktop three column, tablet two column, phone), the contextual help drawer and the phone sheet, search results (with results, no results), the video block with transcript and quality choice, Phone and Desktop toggle, print layout, offline handbook cover, the Help link in the page header and the Help item in the menu and top bar, an "Admin only" role label on an article. SCREEN-ARCHITECTURE gets placeholders for these routes only (section 19).

## 19. Exact edits to existing documents (minimal, in this pull request)

- `docs/MODULES.md`: add the M50 row in the index and an M50 section (purpose, responsibilities, data owned (none: content and files only), dependencies, client input none).
- `docs/SCREEN-ARCHITECTURE.md`: placeholder section for the help routes (`/admin/help`, `/admin/help/path/[path]`, `/admin/help/[id]`, `/admin/help/search`, `/admin/help/media/[...path]`) and the Help entry points, pointing here. No other change.
- `CHANGELOG.md`: one line under Unreleased, Added.
- `docs/DECISIONS.md`: D-359 to D-365.
- `ai-context.md`: the decision number and one line for M50 (migration count unchanged, there is no migration).
- Later, in the build slices (not now): `docs/USER-STORIES.md` gets M50 from section 21, `docs/lanes/L14-build.md`, `docs/LAUNCH-RUNBOOK.md` a handover step, `docs/SECURITY.md` section 5 and `SCREEN-ARCHITECTURE` section 3.3 reconciled (F1, F2).

## 20. Decisions logged (real numbers, appended to `docs/DECISIONS.md`)

| Number | Decision |
|---|---|
| D-359 | The knowledge base lives inside the admin at `/admin/help` with a Help link and contextual panel, visible to all staff with role labels, and offline use is a downloadable handbook, not a cache |
| D-360 | Help videos are static silent MP4 files with a transcript in private storage served through an authenticated route, not catalog titles |
| D-361 | Help content is Markdown plus typed flow files plus committed WebP screenshots in the repo, videos and PDFs are release artifacts, one flow is the source of the video, the pictures and the steps |
| D-362 | Recording and fact checking use an isolated demo stack, demo accounts on `@kb-demo.example`, clearly fake data, and refuse to run against anything else |
| D-363 | Captions are open (burned in) with the same text as a transcript and VTT, and the videos are re-recorded once at handover with the client's name and theme |
| D-364 | Freshness is enforced by a fast changed flows check on pull requests and a full screenshot and video run nightly and on release |
| D-365 | The KB is English only for now and uses the code's roles (Editor, Admin, Super admin) and permissions as the truth |

## 21. User stories, module M50 (Admin help centre)

Add after M49 in `docs/USER-STORIES.md` at build time (Area: Admin, Readiness [READY], dependencies M12, M16, M20, M34, M42, M46 for the reuse of tabs and dialogs). Format follows the file. Role words are Editor, Admin, Super admin.

### M50-S01 Find the help centre from anywhere (Must)
As staff, I want a Help button and menu item on every admin screen, so that I can get help without leaving my place.
- AC1: Given any admin page, When it renders, Then the top bar has a Help button and the side menu has a Help item, both reachable by keyboard.
- AC2: Given a phone width, When I open the menu drawer, Then Help is in it and the button is at least 44 px.
- AC3: Given I am not signed in or I am a viewer, When I open `/admin/help`, Then I am sent to sign in or to No access.
- Edge: the Help item shows for every staff role.
- Error: the help pages fail to load shows one headline, one sentence and Try again.
- Empty: not applicable.

### M50-S02 A Help link on each screen opens the matching article (Must)
As staff, I want the Help link on a page to open the article for that page, so that I do not search.
- AC1: Given any of the 41 admin routes, When I click Help in the page header, Then the article whose `screens` entry matches opens at the right section.
- AC2: Given a route with two articles, When I click Help, Then the panel lists both with the main one first.
- AC3: Given a route with no article, When tests run, Then the route coverage test fails.
- Edge: dynamic routes (`/admin/videos/[id]`) match their pattern.
- Error: a missing article id shows the not found state with search.
- Empty: not applicable.

### M50-S03 Contextual help panel (Must)
As staff, I want a panel that shows the article for the page I am on, so that I can follow the steps beside my work.
- AC1: Given md and up, When I press Help, Then a side drawer opens with the video, the steps and Open full article, and my page stays usable.
- AC2: Given a phone, When I press Help, Then a bottom sheet opens and closes with a swipe, a close button or Escape.
- AC3: Given the panel is open, When I move to another page, Then it updates to that page's article.
- Edge: focus returns to the Help button on close; the question mark key opens the panel only when no field has focus.
- Error: video fails to load shows the transcript and a retry.
- Empty: with no matching article it shows search and the core tasks.

### M50-S04 Learn by path (Must)
As a new staff member, I want ordered paths, so that I know what to learn first.
- AC1: Given `/admin/help`, When it renders, Then Start here is first and the seven paths show their article and video counts.
- AC2: Given a path page, When I open it, Then articles are in learning order with role, read time and watch time.
- AC3: Given an article, When it ends, Then Next and Related are shown.
- Edge: a path never skips ahead past an article that needs an earlier one without showing the Needs line.
- Error: not applicable.
- Empty: a path with no published articles is hidden.

### M50-S05 Article layout and template (Must)
As staff, I want every article laid out the same way, so that I know where to look.
- AC1: Given any article, When it renders, Then it has the six sections in the fixed order and the Who can do this line.
- AC2: Given front matter that breaks the schema, When the build runs, Then it fails and names the file.
- AC3: Given a quoted label, When tests run, Then it matches a label on the live screen.
- Edge: an article for a higher role shows a role label and stays visible.
- Error: a broken image shows its alt text.
- Empty: not applicable.

### M50-S06 Silent captioned video player (Must)
As staff, I want to watch a short video with captions and no sound, so that I can see where to click.
- AC1: Given an article with a video, When I press play, Then the file plays with burned in captions, no sound track, native keyboard controls and a poster.
- AC2: Given Data saver or a screen under 600 px, When the page loads, Then the 480p file is used, with a Quality choice.
- AC3: Given the video, When I open Read this video, Then the transcript lists every caption and pointer action.
- Edge: no autoplay, and reduced motion stops auto advance to the next video.
- Error: file missing shows the transcript and one action, Try again.
- Empty: articles with no video (R and two others) show no player.

### M50-S07 Private media route (Must)
As the owner, I want help videos served only to staff and kept out of the viewer catalog, so that nothing leaks.
- AC1: Given an anonymous request or a viewer, When it asks for a help file, Then it gets 401 or 404.
- AC2: Given a staff request, When it asks for a file, Then it is served with Range support and `Cache-Control: private`.
- AC3: Given the catalog, Home, search, sitemap, analytics and kids profiles, When tests run, Then no help file appears in any of them.
- Edge: a path outside `help/` is refused.
- Error: storage failure gives 502 with a short message.
- Empty: not applicable.

### M50-S08 Search (Must)
As staff, I want to search the help centre in my own words, so that I find the answer fast.
- AC1: Given a search for "poster" or "thumbnail", When I submit, Then the poster articles come first.
- AC2: Given the 12 core tasks, When searched by their plain words, Then the right article is in the top 3.
- AC3: Given no match, When I search, Then I see one headline, one sentence and Browse all articles.
- Edge: typo of one letter still finds the article; slash focuses the box.
- Error: a failed index load shows Try again.
- Empty: an empty box shows recent articles from this browser and the core tasks.

### M50-S09 Print and PDF for each article (Must)
As staff, I want to print or save an article, so that I can keep it by my desk.
- AC1: Given an article, When I choose Print, Then chrome and the player are hidden and all steps and pictures print without cut steps.
- AC2: Given an article, When I choose Download PDF, Then a file for that article and release downloads.
- AC3: Given the print copy, When read, Then it shows the article id and the release it was checked against.
- Edge: pictures print at full width with their alt text if they cannot load.
- Error: PDF missing falls back to the print dialog.
- Empty: not applicable.

### M50-S10 Offline handbook (Should)
As a new volunteer with no account yet, I want a handbook I can open without a server, so that I can learn first.
- AC1: Given a release, When I choose Download the handbook, Then I get a ZIP that opens offline with search, paths and pictures.
- AC2: Given the choice With videos, When I select it, Then videos are included.
- AC3: Given the handbook, When opened, Then it names its release.
- Edge: the ZIP has no personal data and no secrets.
- Error: build missing shows the per path PDFs instead.
- Empty: not applicable.

### M50-S11 Responsive help pages (Must)
As staff on a phone or a laptop, I want pages that fit, so that I can read and watch anywhere.
- AC1: Given widths 360, 600, 960 and 1280, When any help page renders, Then there is no horizontal scroll and targets are at least 44 px.
- AC2: Given a phone with a phone recording, When an article opens, Then Phone is the default view of pictures and video.
- AC3: Given an image, When I tap it, Then it opens a zoomable view that closes with Escape or a button.
- Edge: forced colours and 200 percent zoom keep every control usable.
- Error: not applicable.
- Empty: not applicable.

### M50-S12 Accessibility of the help centre (Must)
As a staff member who relies on assistive technology, I want the help centre to work with my tools, so that I can learn the same way.
- AC1: Given axe on home, article, search and panel at desktop and phone widths, When run, Then there are no serious or critical issues.
- AC2: Given any image, When checked, Then it has alt text; given any video, When checked, Then it has a transcript.
- AC3: Given reduced motion, When the page loads, Then nothing animates and nothing autoplays.
- Edge: burned in captions meet 7 to 1 contrast.
- Error: not applicable.
- Empty: not applicable.

### M50-S13 Demo dataset and isolated stack (Must)
As the developer, I want a clearly fake dataset on an isolated stack, so that recordings never show real data.
- AC1: Given `pnpm kb:stack`, When it runs, Then databases `ad_kb` and `ad_kb_keys` are created and seeded with the demo set in section 11.
- AC2: Given an origin or database outside the allow list, When the recorder starts, Then it refuses.
- AC3: Given a capture, When the page text holds a non demo email or a key shaped string, Then the capture fails.
- Edge: the seed is deterministic; running it twice gives the same state.
- Error: a failed seed leaves nothing half made.
- Empty: not applicable.

### M50-S14 Flow runner proves each procedure (Must)
As the developer, I want one flow per procedure that checks each step, so that the steps are proven.
- AC1: Given a flow, When `pnpm kb:verify --only D02` runs as the flow's role, Then every step finds its control by role and label and every `expect` passes.
- AC2: Given a step that cannot find its control, When it runs, Then the failure names the article, the step and the nearest label.
- AC3: Given a flow, When rendered, Then its `say` lines are the article steps.
- Edge: a role that cannot do the task fails with the role named.
- Error: a timeout retries once, then fails with a screenshot.
- Empty: not applicable.

### M50-S15 Recorder makes silent captioned videos (Must)
As the developer, I want one command to record a flow, so that videos can be made again whenever a screen changes.
- AC1: Given `pnpm kb:record --only D02`, When it runs, Then it makes the 720p and 480p files, a poster, a VTT and a transcript.
- AC2: Given the file, When checked, Then it has no audio stream, a length of 1 to 4 minutes and captions that meet section 5.3.
- AC3: Given `--phone`, When it runs, Then a portrait 390 by 844 version is made.
- Edge: long waits are skipped with a Time skipped badge.
- Error: a failed recording leaves the previous files untouched.
- Empty: not applicable.

### M50-S16 Screenshots with numbered marks (Must)
As staff, I want pictures with numbered marks that match the steps, so that I can find the control.
- AC1: Given a flow step with `shot`, When `kb:shots` runs, Then a WebP with the numbered badge and highlight is saved with alt text.
- AC2: Given a picture, When checked, Then it is at most 120 KB and has no metadata.
- AC3: Given the baseline, When the screen changes by more than 0.5 percent of pixels, Then the nightly check fails with the diff image.
- Edge: dark by design screens are captured dark.
- Error: a missing control fails the shot.
- Empty: not applicable.

### M50-S17 Coverage tests keep it complete (Must)
As the developer, I want tests that fail when the product grows past the help, so that the KB stays complete.
- AC1: Given a new admin route, nav item, permission or setting, When tests run, Then they fail until the KB covers it.
- AC2: Given R02, R03, R04 and R06, When built, Then they are generated from `can.ts`, `NAV_ITEMS`, the settings registry and the enums.
- AC3: Given a Who can do this line, When it disagrees with `can.ts`, Then the build fails.
- Edge: a text only article is allowed without a flow when marked.
- Error: not applicable.
- Empty: not applicable.

### M50-S18 CI catches a screen that no longer matches (Must)
As the developer, I want a pull request that breaks a recorded screen to fail, so that help never lies.
- AC1: Given a change under the admin screens, When CI runs, Then only the affected flows run and a failure names the article and step.
- AC2: Given a release tag or the nightly job, When it runs, Then all flows run and all screenshots are compared.
- AC3: Given an article not verified since its sources changed, When status is read, Then it is listed stale.
- Edge: a flow that depends on a changed shared component is included through `dependsOn`.
- Error: an infrastructure failure is reported as infrastructure, not as a content failure.
- Empty: not applicable.

### M50-S19 Writing and caption rules are enforced (Must)
As the owner, I want every article and caption to follow the plain English rules, so that it is easy to read.
- AC1: Given any article or caption, When linted, Then it has no dash, no emoji and no banned word, and a step has at most one action and 25 words.
- AC2: Given captions, When checked, Then lines are at most 42 characters and 2 lines, and speed is at most 15 characters a second.
- AC3: Given the glossary, When an article uses a glossary term first, Then it links to it.
- Edge: quoted labels are exempt from the banned word list.
- Error: not applicable.
- Empty: not applicable.

### M50-S20 Start here path (Must)
As a new staff member, I want the Start here path, so that I can sign in and publish my first video.
- AC1: Given S01 to S08, When published, Then each has text, video, pictures and passes the fact checker.
- AC2: Given the Vanessa test, When a new person follows S02 to S06, Then they publish a demo video.
- AC3: Given a phone, When S02 and S04 are opened, Then the phone recordings are offered.
- Edge: S03 works with an expired invite by pointing to C11.
- Error: not applicable.
- Empty: not applicable.

### M50-S21 Daily and weekly paths (Must)
As an Editor, I want the daily and weekly paths, so that I can run the content routine.
- AC1: Given D01 to D12 and W01 to W13, When published, Then each passes its gates and the fact checker as the right role.
- AC2: Given an Admin only step, When shown to an Editor, Then it is labelled.
- AC3: Given the phone articles in these paths, When opened, Then phone recordings play.
- Edge: where docs and code disagree on a role, the article follows the code.
- Error: not applicable.
- Empty: not applicable.

### M50-S22 Setup, money, safety and troubleshooting paths (Must)
As an Admin or Super admin, I want the setup, money, safety and troubleshooting paths, so that I can run the whole platform.
- AC1: Given C01 to C14, M01 to M09, K01 to K08 and T01 to T11, When published, Then each passes its gates.
- AC2: Given the money articles, When read, Then no real key, bank detail or person appears and the developer owned steps are named.
- AC3: Given every T article, When opened, Then it links to the article that fixes the cause.
- Edge: T11 lists what to send and never asks for a password or key.
- Error: not applicable.
- Empty: not applicable.

### M50-S23 Release stamp and keep it fresh (Should)
As the owner, I want each article to say which release it was checked against, so that I know it is current.
- AC1: Given an article, When shown, Then the footer reads Checked against release X on a date.
- AC2: Given a new release, When `kb:publish` runs, Then the media pointer moves and the previous release stays for rollback.
- AC3: Given R08, When a release is made, Then it lists the admin changes from `CHANGELOG.md`.
- Edge: a rollback restores the previous pointer in one step.
- Error: a failed upload leaves the pointer unchanged.
- Empty: not applicable.

### M50-S24 Tell us what is unclear (Could)
As staff, I want a quick way to say an article is unclear, so that it can be improved.
- AC1: Given an article, When I choose Tell us what is unclear, Then a message to the support email opens with the article id filled in.
- AC2: Given the feature, When checked, Then no feedback or view count is stored on the server in this phase.
- AC3: Given a later decision to count feedback, When made, Then it needs a new decision and a privacy note.
- Edge: no support email set hides the link.
- Error: not applicable.
- Empty: not applicable.

Counts: 24 stories. Must 21 (S01 to S09, S11 to S22), Should 2 (S10, S23), Could 1 (S24).

## 22. Scoped test commands (build time, never the full suite)

Per slice, one file at a time, for example `pnpm vitest run packages/help/src/frontmatter.test.ts`, `pnpm vitest run apps/web/src/components/admin/help/HelpPanel.test.tsx`, `pnpm vitest run scripts/kb-coverage.test.ts`. Layout and axe checks run with `pnpm exec playwright test apps/web/e2e/admin-help.e2e.ts`. The `kb:*` jobs are separate CI jobs, not part of the unit test run. Every commit runs `scripts/footprint-check.sh` and a grep of the diff for dashes and emojis (CLAUDE.md).
