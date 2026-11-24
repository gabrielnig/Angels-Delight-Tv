# L3 Admin polish, bulk actions, captions control (module M42)

Status: planning pass, docs only. Date: 24 November 2026. Base: origin/main 08d6e86. Source: owner punch list items 1 to 5 in `docs/audits/2026-11-24-netflix-rea-audit.md` section 6.

Nothing here needs client input. Every choice below takes the recommended option (CLAUDE.md "Decisions") and is logged in section 11 for `docs/DECISIONS.md` at build time. Decision ids in this plan are written `L3-D01` and so on; the build renumbers them to the next free D-number on origin/main (highest today is D-168).

## 1. Scope

In scope:

1. Container padding on the Encoding queue and Failed encodes lists, and the same defect checked across every admin list and table container.
2. One table alignment rule, applied to all 14 admin tables, with a test that keeps it true.
3. One shared breadcrumb component for admin and viewer, fixing the first crumb sitting lower than the last, long titles and mobile wrap.
4. A shared bulk action framework (selection, action bar, confirm, progress, results report, undo, audit) and its use on Videos (gaps), Captions, Encoding, Failed encodes, Viewer accounts, Staff and invites, Series, Trash and Upload.
5. Captions on and off: a per video switch with a site default, a permission, a bulk toggle, and the viewer CC button honouring it while staying remembered per profile.

Out of scope: audit punch list items 6 to 8 (Home hero, rows, View all links) which belong to other lanes; deleting viewer accounts in bulk (stays single, typed, Super admin only per M27-S03 AC3); series Trash (decision L3-D12); translated caption tracks (M15-S11); any viewer facing redesign beyond the breadcrumb and CC button.

Stories: new module M42, 22 stories (section 8), plus 17 exact edits to existing stories (section 9). Mockups S100 to S109 (section 10).

## 2. Current state (verified in code on origin/main)

- Videos list has a working bulk bar: `apps/web/src/components/admin/VideosList.tsx` with `applyBulk` in `apps/web/src/lib/data/admin/video-queries.ts` and `bulkAdminVideos` in `packages/catalog/src/admin/videos.ts`. Actions: publish, unpublish, trash, add category, set suitability (all or nothing). Gaps against M16-S09: no typed count on trash, no Retry failed after a partial result, count is not announced (plain `<strong>`), selection is dropped on page change, publish has no confirm and no count, no undo, no audit summary.
- Captions list (`CaptionList.tsx`) is a server rendered table with no selection. Track data has `source` (`whisper` or `manual`), `updatedBy`, `approvedCues`, so "auto captions never edited" can be derived, but no field exposes it.
- Encoding queue (`EncodingQueue.tsx`) and Failed encodes (`FailedEncodes.tsx`) retry one row at a time. Failed encodes has "Clean up all" only.
- Users (`UsersTable.tsx`) is a server rendered GET form table with no selection. Staff and invites are on `/admin/roles` (`RolesInvites.tsx`) with per row actions. Server rules exist: cannot change own role, last Super admin guard (`users-commands.ts changeRole`), resend invite, revoke invite.
- Series (`SeriesList.tsx`) is a card list with no selection. `deleteSeries` removes the series row and its seasons (`packages/catalog/src/admin/series.ts` sets `deleted_at` and deletes seasons), so a restore is not possible today.
- Trash (`TrashList.tsx`) restores and purges one video at a time. It lists videos only.
- Upload (`UploadScreen.tsx`, `UploaderContext.tsx`) queues independent lanes, with only a "parallel uploads" setting. `registerUploadAction(name, sizeBytes)` takes no details.
- Viewer captions: the player already remembers CC per profile (`captionsDefault` in the profile preferences, `features/player/preferences.ts`, M11-S02), kids profiles start with captions on (`real-playback.ts` line 142), and the CC button hides when a video has no tracks (M11-S01 Empty). There is no way to switch captions off for a video or for the whole site.
- Permission matrix: `apps/web/src/lib/admin/can.ts` (one table, unknown actions denied). `video.purge` is `admin`, `caption.review` is `editor`, `series.manage` is `editor`, `users.suspend` is `admin`, `roles.change` is `super_admin`.

## 3. UI review of the current screens (items 1 to 3)

Reviewed against the audit, `docs/DESIGN-SYSTEM.md` 11.16 (table), section 611 (page header with breadcrumb) and the `angels-delight-design-system` skill checklist (tokens only, 44px targets, states, mobile first, no horizontal scrolling for critical tasks).

### 3.1 Item 1: container padding

Finding F1 (Fail). `EncodingQueue.tsx` line 109 and `FailedEncodes.tsx` line 102 render `<ul className="adm-card adm-list">`. In `admin.css` `.adm-card` sets `padding: var(--space-4)` (line 584) and `.adm-list` sets `padding: 0` (line 1036). Both are one class, so the later rule wins and the card has zero padding. Row text, the progress bar and the danger banner touch the card border. Row top and bottom look fine only because `.adm-list > li` has its own `padding: var(--space-3) 0`.

Finding F2 (Fail). Same family, wide tables on phones: every table card forces `style={{ display: 'table' }}` inline (CaptionList, TrashList, UsersTable, AuditLogView, SystemView, ExportsView, RolesInvites, AnalyticsView, InviteCodesTab, ThemeHistoryView), which defeats `.adm-table { display: none }` below 64rem. `.adm-table-card` has `overflow: hidden`, so on a 360px phone columns are clipped at the right edge with no scroll. DESIGN-SYSTEM 11.16 says tables become stacked cards or the first column is sticky.

Finding F3 (Fail, minor). Table header strips use inline `style={{ padding: 'var(--space-4) var(--space-4) 0' }}` in five places (RolesInvites x2, AnalyticsView, SystemView, InviteCodesTab). Inline styles bypass the token review and drift.

Containers checked and passing: Videos table card (padding 0 by design, cells carry `padding: 0 var(--space-3)`), Series and Categories cards (`adm-card adm-listrow` keeps card padding), Dashboard, Analytics, System, User detail and Settings lists (`adm-list` inside a `Card`, which supplies padding), Exports, Audit log, Invite codes, Theme history (table cards). First and last table cells only have `--space-3` inset against a `--space-4` card padding elsewhere, so edge text sits closer to the border than the card titles. Fixed in 3.2 as a consistency fix.

Fix (exact CSS, `apps/web/src/components/admin/admin.css`, placed directly after the `.adm-list` block):

```css
/* A list that is itself the card: keep the card's horizontal padding (the .adm-list reset above would remove it). */
.adm-card.adm-list {
  padding: var(--space-1) var(--space-4);
  gap: 0;
}
.adm-card.adm-list > li:last-child {
  padding-bottom: var(--space-3);
}

/* Tables: always a table on every width, scrolls sideways instead of clipping */
.adm-table--always {
  display: table;
}
.adm-table-card {
  overflow-x: auto;
  overflow-y: hidden;
}
.adm-table-card > .adm-card__head {
  padding: var(--space-4) var(--space-4) var(--space-2);
}
.adm-table-card > .adm-muted {
  margin: 0;
  padding: 0 var(--space-4) var(--space-3);
}
/* wide tables keep the first column visible while scrolling */
@media (max-width: 63.99rem) {
  .adm-table--sticky th:first-child,
  .adm-table--sticky td:first-child {
    position: sticky;
    inset-inline-start: 0;
    background: var(--color-surface);
    z-index: var(--z-raised);
  }
  .adm-table--sticky thead th:first-child {
    background: var(--color-surface-sunken);
  }
}
```

Markup changes: replace every inline `style={{ display: 'table' }}` with `className="adm-table adm-table--always"` (add `adm-table--sticky` on the wide ones: AuditLogView, ExportsView, SystemView, InviteCodesTab, ThemeHistoryView, RolesInvites matrix, AnalyticsView); replace the five inline header paddings with `<div className="adm-card__head">` wrapping the heading; Captions, Trash and Users get stacked mobile cards (decision L3-D03) in slices L3-07, L3-10, L3-12 so they do not use `--always`. `--z-raised` is checked in tokens.css at build; if absent the slice uses the existing sticky layer token.

### 3.2 Item 2: table alignment (Captions Cues and all tables)

Root cause R1. `.adm-table th { text-align: left }` (specificity 0,1,1) beats `.adm-num { text-align: right }` (0,1,0). Every header marked `adm-num` renders left aligned while its cells (`td.adm-num`, specificity 0,1,0 and no competing td rule) render right aligned. The header therefore sits over the left edge of a right aligned value, between neighbouring headers. This is what the owner saw under Cues, and it also affects Videos (Length, Views), Trash (Days left), Users (Profiles), Analytics (three columns) and System (Count).

Root cause R2. Exports has numeric columns (Rows, Size) with no `adm-num` on header or cell, so they are left aligned while the other tables right align numbers.

The rule (L3-D01), written into DESIGN-SYSTEM 11.16:

| Column content | Header | Cells | Class |
|---|---|---|---|
| Quantities: counts, sizes, durations, percentages, days left, rows, uses | right | right, tabular numerals | `adm-num` |
| Text, titles, names, emails, dates, times, identifiers (v3, codes) | left | left | none |
| Status badges and short tags | left | left | none |
| Yes or No marks and icon only booleans (permission matrix) | centre | centre | `adm-ctr` |
| Row actions column (header is screen reader only) | right | right, buttons right aligned | `adm-actions` |

Header and cells of one column always share the same class. A column mixing numbers and words (for example Cues showing "Working" or "None") is a numeric column: words are right aligned too, not centred.

Exact CSS (replaces nothing, appended after the `.adm-table td` rules, line 1285 region):

```css
.adm-table th.adm-num,
.adm-table td.adm-num {
  text-align: right;
  font-variant-numeric: tabular-nums;
}
.adm-table th.adm-ctr,
.adm-table td.adm-ctr {
  text-align: center;
}
.adm-table th.adm-actions,
.adm-table td.adm-actions {
  text-align: right;
}
.adm-table td.adm-actions .adm-row {
  justify-content: flex-end;
}
.adm-table th:first-child,
.adm-table td:first-child {
  padding-inline-start: var(--space-4);
}
.adm-table th:last-child,
.adm-table td:last-child {
  padding-inline-end: var(--space-4);
}
```

Audit of every admin table (14 tables in 12 files), with the change each needs:

| # | Table (file) | Numeric columns | State today | Change |
|---|---|---|---|---|
| 1 | Videos (`VideosList.tsx`) | Length, Views | header left, cell right (R1) | fixed by CSS; add `adm-actions` to last column |
| 2 | Captions (`CaptionList.tsx`) | Cues | header left, cell right (R1) | fixed by CSS; add `adm-actions` to last column |
| 3 | Trash (`TrashList.tsx`) | Days left | R1 | fixed by CSS; `adm-actions` on last column |
| 4 | Viewer accounts (`UsersTable.tsx`) | Profiles | R1 | fixed by CSS |
| 5 | Staff (`RolesInvites.tsx`) | none | ok | none |
| 6 | Permission matrix (`RolesInvites.tsx`) | Yes or No marks | left | add `adm-ctr` to the three role headers and cells |
| 7 | Top titles (`AnalyticsView.tsx`) | Views, Watch time, Completion | R1 | fixed by CSS |
| 8 | Audit log (`AuditLogView.tsx`) | none (Time, Who, Action, What, Result are text) | ok | none |
| 9 | Audit entry changes (`AuditLogView.tsx`) | none | ok | none |
| 10 | Jobs (`SystemView.tsx`) | none | ok | none |
| 11 | Error counts (`SystemView.tsx`) | Count | R1 | fixed by CSS |
| 12 | Exports (`ExportsView.tsx`) | Rows, Size | R2 | add `adm-num` to both headers and both cells |
| 13 | Invite codes (`site/InviteCodesTab.tsx`) | Uses (shown as used of max) | left | add `adm-num` to header and cell |
| 14 | Theme history (`theme/ThemeHistoryView.tsx`) | none (Version is an identifier) | ok | none |

Test that keeps it true (slice L3-01): a helper `expectColumnAlignment(table)` that, for every column index, requires the header and all cells in that column to share the same alignment class, and that numeric classes are used for the columns this plan lists. A CSS test reads `admin.css` and fails if a `.adm-table th` text-align rule exists without a matching `th.adm-num` rule after it.

### 3.3 Item 3: breadcrumbs

Root cause R3. `PageHeader.tsx` renders `<ol>` with `<li><a>` and `<li><span aria-current>`. In `admin.css` (line 436) `.adm-crumbs a` is `display: inline-flex; align-items: center; min-height: var(--touch-target)` (44px) while the current page `span` is plain inline text. The `ol` is a flex row, and its `li` items stretch to the tallest item, so inside the stretched `li` the link text is vertically centred in a 44px box and the span text sits at the top. On Encoding (`Admin / Encoding`) the link "Admin" therefore renders about 12px lower than "Encoding". Pages with three crumbs show two low links and a high current page. The viewer copy in `components/title/title.css` (`.tv-crumbs a` min-height 44px, current span plain) has the same defect and is a second implementation.

Other findings:
- F4 (Fail). A long video title as the last crumb (Video editor, Preview, Captions review, Poster picker: `videos/[id]/...`, `captions/[videoId]`, `analytics/[id]`) wraps under the slash separators and pushes the H1 down. There is no truncation and no `min-width: 0`.
- F5 (Fail). On a phone the full trail of up to four crumbs wraps to two or three lines of 44px links above the H1.
- F6 (Fail). `breadcrumbTrail()` in `nav.ts` is unused; 24 pages hand write their crumbs, so nothing guarantees `Admin` first with `href: '/admin'`.
- F7 (Info). Viewer: only the title page has crumbs (`TitleView.tsx`, hidden below the desktop breakpoint). Series, Browse category, Search and Watch have none by design (the player owns its own back control, M08-S26). Not adding crumbs there.

Fix (decision L3-D02): one component `Breadcrumbs` in `@ad/ui` used by admin `PageHeader` and the viewer title page. Both old CSS blocks are deleted.

`packages/ui/src/components/Breadcrumbs.tsx` (shape, load bearing):

```tsx
export interface Crumb { label: string; href?: string }
export function Breadcrumbs({ items, renderLink, tone = 'admin' }: {
  items: Crumb[];
  renderLink?: (props: { href: string; children: ReactNode }) => ReactNode;
  tone?: 'admin' | 'viewer';
}) {
  const link = renderLink ?? (({ href, children }) => <a href={href}>{children}</a>);
  return (
    <nav aria-label="Breadcrumb" className={`ad-crumbs ad-crumbs--${tone}`}>
      <ol>
        {items.map((c, i) => (
          <li key={`${c.label}-${i}`}>
            {c.href && i < items.length - 1
              ? link({ href: c.href, children: c.label })
              : <span aria-current="page" title={c.label}>{c.label}</span>}
          </li>
        ))}
      </ol>
    </nav>
  );
}
```

`packages/ui/src/components.css`:

```css
.ad-crumbs ol {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  margin: 0;
  padding: 0;
  list-style: none;
  color: var(--color-muted);
  font-size: var(--text-caption);
}
.ad-crumbs li {
  display: inline-flex;
  align-items: center;
  min-width: 0;
  min-height: var(--touch-target);
}
.ad-crumbs li + li::before {
  content: '/';
  flex: none;
  padding: 0 var(--space-2);
}
/* link and current page are the same box, so the baselines match */
.ad-crumbs a,
.ad-crumbs [aria-current='page'] {
  display: inline-flex;
  align-items: center;
  min-height: var(--touch-target);
  line-height: var(--leading-normal, 1.5);
}
.ad-crumbs a {
  color: var(--color-muted);
}
.ad-crumbs--viewer a {
  color: var(--color-primary);
  text-decoration: underline;
}
.ad-crumbs [aria-current='page'] {
  color: var(--color-ink);
  min-width: 0;
  max-width: 40ch;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
/* Phones: show only the parent as a back link. The rest stay in the accessibility tree. */
@media (max-width: 47.99rem) {
  .ad-crumbs li:not(:nth-last-child(2)):not(:only-child) {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip-path: inset(50%);
  }
  .ad-crumbs li:nth-last-child(2)::before {
    content: '\2039' / '';
    padding: 0 var(--space-2) 0 0;
  }
  .ad-crumbs li:nth-last-child(2) + li::before {
    content: none;
  }
}
@media (hover: hover) {
  .ad-crumbs a:hover {
    color: var(--color-ink);
  }
}
```

The viewer title page keeps its desktop only visibility with `.tv-crumbs { display: none }` replaced by a wrapper rule in `title.css` (`.tv .ad-crumbs { display: none }` until the breakpoint it uses today), so viewer behaviour does not change except alignment.

Tests (L3-02): `Breadcrumbs.test.tsx` below; `crumbs-audit.test.ts` scans every `apps/web/src/app/admin/(shell)/**/page.tsx` that renders `PageHeader` and requires `crumbs` to begin with `{ label: 'Admin', href: '/admin' }` and the last item to have no `href`; and a Playwright check recorded in the PR (not in the unit suite) that `getBoundingClientRect().top` of every `li` text node in the trail is equal at 1280px and 360px, using a 120 character title.

## 4. Shared bulk action framework (slice L3-03)

Every bulk screen uses the same parts so behaviour is identical. Files, all new unless noted:

- `apps/web/src/lib/data/admin/bulk.ts`: pure types and helpers. `BulkOutcome { succeeded: string[]; failed: {id; reason}[]; skipped: {id; reason}[]; undo?: BulkUndo; bulkId: string }` (extends today's `BulkResult`, which keeps working because `skipped` and `undo` are optional), `chunkIds(ids, size = 25)`, `MAX_BULK_CALL = 200`, `MAX_SELECTION = 500`, `mergeOutcomes(a, b)`, `newBulkId()`, `describeOutcome(label, outcome)` (the one sentence summary), `eligibility(rows, rule)` (splits selected rows into eligible and skipped with reasons).
- `apps/web/src/components/admin/bulk/useSelection.ts`: selection by id in a `Set`, survives `router.refresh()` polling, prunes ids that disappear from the data, supports page scope and "all matching" scope (L3-06), exposes `count`, `toggle`, `togglePage`, `clear`, `scope`.
- `apps/web/src/components/admin/bulk/BulkBar.tsx`: the sticky bar. Left: live count (`role="status"`, polite) "12 selected" and, when scope is page and more rows match, "Select all 48 that match". Middle: action slot (primary action, selects, "More" menu on narrow widths). Right: Clear. Below 48rem it docks to the bottom edge with `padding-bottom: env(safe-area-inset-bottom)` and moves secondary actions into a "More" menu button (`aria-haspopup="menu"`). Existing `.adm-bulk` CSS is replaced by `.adm-bulk`, `.adm-bulk__count`, `.adm-bulk__actions`, tokens only.
- `apps/web/src/components/admin/bulk/useBulkRun.ts`: runs a server action over chunks, tracks progress, supports cancel between chunks, merges outcomes, pauses on offline and resumes on online, reports through the toast and the report panel. Server actions never receive more than `MAX_BULK_CALL` ids and the server slices again (defence in depth, as `bulkVideosAction` does with 200 today).
- `apps/web/src/components/admin/bulk/BulkReport.tsx`: the results panel (section 4.2).
- `apps/web/src/components/admin/bulk/BulkProgress.tsx`: progress bar with a number "Done 50 of 120", Cancel, and an offline note.
- `apps/web/src/components/admin/Dialog.tsx` (edit): add `TypedConfirmDialog` (type a count or a word to enable the danger button) and an `acknowledge` option (a required checkbox) on `ConfirmDialog`. Focus trap, Esc, focus restore already exist.
- `apps/web/src/server/admin/bulk-audit.ts`: `recordBulk(audit, actor, { action, bulkId, ids, outcome })` writes one `bulk.run` summary row (counts, first 50 ids, label) and callers write their normal per item rows with `extra.bulkId`.

### 4.1 Selection model and cross page selection (decision L3-D05)

- Default scope is the rows on the current page. The header checkbox selects the page. Moving to another page or changing a filter clears the selection (as `VideosList` does today), and the bar says so in a short note ("Selection cleared") so nothing stays selected out of sight.
- When a page is fully selected and the filter matches more rows than the page, the bar offers "Select all N that match this filter". N is read from `page.total`. The client then sends the filter, not the ids: the server re-runs the query, takes up to `MAX_SELECTION` (500) ids newest first, and returns them, so the user sees "Selected 48. The first 500 are used when more match." The selection is a snapshot of ids; rows that change status before the run are handled per id by the action (they fail or skip with a reason).
- All matching is allowed only for non destructive, easily reversed actions: add or remove category, set suitability, captions availability, Restore (Trash). It is never offered for publish, trash, delete forever, approve captions, user or staff actions, or series delete. Those are page scope only so a person sees what they are about to change.
- Encoding and Failed encodes list every failed job on one page, so scope questions do not arise there. Trash lists up to 200 oldest deleted first, one page.

### 4.2 Results report, partial failure and retry

After every run the bar is replaced by a report panel in place (not only a toast), because toasts vanish:

- All succeeded: success toast "Publish: 12 done." with Undo for 10 seconds where the action is reversible (section 4.3). No panel.
- Some failed or skipped: `Banner tone="warning"` panel, `role="status"`: "Publish: 9 done, 2 could not be changed, 1 skipped." Below it a list, one line per item: title (link), then the plain reason ("Not ready: Captions needs attention first."). Buttons: "Retry the 2 that failed" (only failed, not skipped, and only when the reason is retryable: network, timeout, locked row; not "no permission" or "not ready"), "Copy list" (titles and reasons as text), "Dismiss". Retry runs the same action on the failed ids and merges into the same panel.
- Nothing succeeded: `tone="danger"` panel with the same list and no Undo.
- Network or server error before any result: "Publish did not work. Nothing was changed. Try again." and selection kept. If a chunk run is interrupted midway, the panel says exactly which chunks completed ("Done 50 of 120 before the connection dropped") and offers Continue.
- The panel stays until dismissed or the next run, announced once through `role="status"`; the focus moves to the panel heading after a run so keyboard users land on the result.

### 4.3 Undo where cheap (decision L3-D07)

Undo is a 10 second toast button after a fully or partly successful run, held only in client memory. The server returns an `undo` descriptor, and the undo call re-checks permission and uses compare and set (it only reverts items still in the state the run left them in).

| Action | Undo | How |
|---|---|---|
| Move to Trash (videos) | yes | restore the succeeded ids (comes back as Draft per M16-S06; an unpublished video was already unpublished by trash, so undo restores to Draft, stated in the toast) |
| Restore from Trash | yes | move the succeeded ids back to Trash |
| Publish, Unpublish | yes | the inverse on succeeded ids that still have the state the run set |
| Add category, Remove category | yes | the inverse on succeeded ids |
| Set suitability | yes | previous value per id kept in the descriptor |
| Captions available on or off | yes | previous tri state per id |
| Suspend, Reinstate viewer accounts | yes | the inverse (Suspend undo needs no reason because it reinstates) |
| Series publish, unpublish | yes | the inverse |
| Retry encodes | no | a started job cannot be cheaply cancelled |
| Approve captions | no | publishes a public VTT to the CDN; the toast says so and the confirm dialog warned |
| Delete forever, Series delete | no | removed; typed confirmation is the safeguard |
| Staff role change, disable, resend invite | no | security changes are never silently reverted; change back by hand (audited) |

## 5. Permissions (role matrix additions)

New and changed rows in `apps/web/src/lib/admin/can.ts` (the test "every action has an explicit role mapping" in M12-S04 AC3 fails until each is present) and in `docs/SECURITY.md` section 5:

| Action key | Min role | Used by |
|---|---|---|
| `caption.approve_bulk` | admin | Bulk approve captions (L3-07). Editors still approve one track at a time (`caption.review`). |
| `caption.availability` | admin | Per video switch and bulk toggle (L3-05, L3-08). Same level as `caption.override` because switching captions off satisfies the publish gate. |
| `encode.retry` | editor | Single and bulk retry (replaces `video.edit` for this action, same effective role, so M14-S09 AC4 holds). |
| `series.delete` | admin | Single and bulk series delete (L3-11). Today `series.manage` (editor) can delete a series; this is a deliberate tightening, matching `video.delete`. |
| `users.bulk` | admin | Bulk suspend, reinstate, force sign out, resend verification on viewer accounts (L3-12). Single actions keep `users.suspend`. |
| `roles.bulk` | super_admin | Bulk staff role change, disable, resend invite (L3-13). |
| existing `settings.flags` | super_admin | Site default for captions (L3-05). |
| existing `video.purge` | admin | Delete forever, single and bulk (L3-10). |

New rows for the SECURITY.md table (columns anonymous, viewer, editor, admin, super_admin):

| Approve captions in bulk, switch captions on or off for a video or in bulk | no | no | no | yes | yes |
| Delete a series | no | no | no | yes | yes |
| Bulk actions on viewer accounts (except delete) | no | no | no | yes | yes |
| Bulk staff role change, disable, resend invite | no | no | no | no | yes (re-auth, not self) |

Doc and code mismatches found while planning, to correct in L3-17: SECURITY.md lists "retry or discard failed jobs" as Super admin only (that is the System jobs screen, `system.jobs`), while encoding retry is editor level in code and in M14-S09 AC4; M16-S06 says only a Super admin can Delete forever while code and the Trash UI use admin (`video.purge`). The plan keeps the code and fixes the docs (edit E8 below).

Safeguards that apply to every bulk action: the server checks the role per call and per id (a forged id list from a lower role gets 403 and an audit `outcome: denied`); the acting account is removed from any target list server side; limits (`MAX_BULK_CALL` 200 per call, rate limit 20 bulk calls per admin per minute through the existing admin policy in `@ad/security`); same origin check as every action; all ids validated as UUIDs.

## 6. Build list (numbered slices)

Order matters: L3-01 and L3-02 are independent and first (they fix what the owner sees). L3-03 unblocks everything bulk. L3-05 (captions availability backend) is independent of the bulk work. Each slice is one branch and one PR, TDD per CLAUDE.md: write the failing test, run only that file with `pnpm vitest run <path>`, then build to green. Run `scripts/footprint-check.sh` before each commit and the design skill review on every UI slice. DB integration tests need `TEST_DATABASE_ADMIN_URL` as in DEV-SETUP.md.

Failing tests are listed by file and exact `it` name.

### L3-01 Layout fixes: padding, table alignment, table containers (items 1 and 2)

Files: `apps/web/src/components/admin/admin.css`, `EncodingQueue.tsx`, `FailedEncodes.tsx`, `CaptionList.tsx`, `TrashList.tsx`, `UsersTable.tsx`, `VideosList.tsx`, `AnalyticsView.tsx`, `SystemView.tsx`, `ExportsView.tsx`, `RolesInvites.tsx`, `AuditLogView.tsx`, `site/InviteCodesTab.tsx`, `theme/ThemeHistoryView.tsx`; new `apps/web/src/components/admin/test-utils/table-alignment.ts`.

Tests first:
- `apps/web/src/components/admin/admin-css.test.ts`: "a list that is also a card keeps horizontal padding", "numeric table headers use a rule at least as specific as the th reset", "tables are never forced to display table with an inline style" (greps component sources).
- `apps/web/src/components/admin/tables.test.tsx`: "Captions: Cues header and cells share the numeric class", "Trash: Days left header and cells share the numeric class", "Users: Profiles header and cells share the numeric class", "Exports: Rows and Size are numeric columns", "Invite codes: Uses is a numeric column", "System errors: Count is a numeric column", "Analytics top titles: all three figure columns are numeric", "Roles matrix: Yes or No columns are centred in header and cells", "Videos: Length and Views are numeric".
- `apps/web/src/components/admin/EncodingQueue.test.tsx` (new): "the jobs list is a card with padded rows", "a failed job shows retry beside the badge".

Migrations: none. Permissions: none.

### L3-02 Shared Breadcrumbs (item 3)

Files: new `packages/ui/src/components/Breadcrumbs.tsx` and `Breadcrumbs.test.tsx`, edit `packages/ui/src/components.css` and `packages/ui/src/components/index.ts`; edit `apps/web/src/components/admin/PageHeader.tsx` (use it with `renderLink` from `next/link`), delete `.adm-crumbs` rules in `admin.css`; edit `apps/web/src/components/title/TitleView.tsx` and `title.css` (use it with `tone="viewer"`, delete `.tv-crumbs` rules). Remove unused `breadcrumbTrail` from `nav.ts` and its test, or keep it and make pages use it (the build chooses the smaller diff: delete).

Tests first:
- `packages/ui/src/components/Breadcrumbs.test.tsx`: "the last item is the current page and is not a link", "links and the current page render in the same row box" (asserts both carry the shared inline flex classes), "a long current title is truncated with the full text in the title attribute", "a single item renders as the current page", "uses the supplied link renderer for hrefs", "has a navigation landmark named Breadcrumb".
- `apps/web/src/components/admin/PageHeader.test.tsx` (new): "renders crumbs above the heading with Admin first".
- `apps/web/src/app/admin/crumbs-audit.test.ts`: "every admin page with a PageHeader starts its crumbs at Admin", "the last crumb never has a link", "intermediate crumbs all have an href".
- `apps/web/src/components/title/TitleView.test.tsx` (edit): "title page breadcrumb shows Browse, category and title".

### L3-03 Bulk core

Files: section 4. Edit `Dialog.tsx`, `admin.css` (`.adm-bulk*` block), `Toast.tsx` (toast with an action button and a longer lifetime for Undo, if it lacks one).

Tests first:
- `lib/data/admin/bulk.test.ts`: "chunkIds splits 60 ids into chunks of 25, 25 and 10", "mergeOutcomes sums succeeded, failed and skipped", "describeOutcome says 9 done, 2 could not be changed, 1 skipped", "eligibility keeps the rows a rule accepts and explains each skipped one", "newBulkId is unique per run", "selection beyond MAX_SELECTION is cut and flagged".
- `components/admin/bulk/useSelection.test.tsx`: "toggle and togglePage change the count", "ids that leave the data are pruned", "selection survives a refresh with the same rows", "all matching scope reports the capped count".
- `components/admin/bulk/BulkBar.test.tsx`: "announces the selected count politely", "shows Select all N that match only when the page is fully selected and more rows match", "Clear empties the selection and returns focus to the table", "narrow layout moves secondary actions into a More menu", "buttons carry a reason when disabled".
- `components/admin/bulk/BulkReport.test.tsx`: "all succeeded shows a toast with Undo and no panel", "partial failure lists each reason", "Retry offers only retryable failures", "Copy list copies titles and reasons", "nothing succeeded uses the danger tone", "interrupted run offers Continue".
- `components/admin/bulk/useBulkRun.test.tsx`: "runs chunks in order and reports progress", "cancel stops after the current chunk", "pauses while offline and resumes online", "a thrown chunk becomes an interrupted outcome with the done count".
- `components/admin/Dialog.test.tsx` (edit): "TypedConfirmDialog keeps the danger button disabled until the typed text matches", "matching is exact and ignores surrounding spaces", "acknowledge checkbox must be ticked", "focus returns to the opener on close".
- `server/admin/bulk-audit.test.ts` (with the audit writer fake): "writes one bulk.run row and one row per changed item with the same bulkId", "caps the id list in the summary at 50", "denied runs write outcome denied".

Migrations: none (`extra.bulkId` lives in the existing audit metadata). Permissions: none yet.

### L3-04 Videos list moves to the core and closes its gaps

Files: `VideosList.tsx`, `video-queries.ts` (add `remove_category`, `captions_available` to `BulkAction`; keep suitability all or nothing), `video-queries.test.ts`, `packages/catalog/src/admin/videos.ts` (`bulkAdminVideos` adds the two actions and returns `undo` and `bulkId`), `apps/web/src/app/admin/(shell)/videos/actions.ts` (add `undoBulkVideosAction`).

Tests first:
- `video-queries.test.ts`: "remove_category removes only where present and reports the rest as skipped", "bulk results carry an undo that restores previous suitability per id", "publish reports Not ready with the first blocker per failed id".
- `VideosList.test.tsx` (edit): "Move to Trash needs typing the count when 5 or more are selected", "Publish asks for confirmation that states the count", "partial failure shows the report with Retry on retryable ones", "undo after trash restores the same ids", "selecting a full page offers select all that match for Add to category but not for Publish", "the count is announced".
- `packages/catalog/src/admin/videos.int.test.ts` (edit): "bulk remove category is audited per video with one bulk.run", "undo of trash only restores videos still in Trash", "an editor forging a trash call gets denied and audited".

Migrations: none. Permissions: none new.

### L3-05 Captions availability: backend, publish gate, site default (item 5, part 1)

Resolution (decision L3-D15): each video has a tri state `captionsEnabled`: `null` follows the site default, `true` offers captions, `false` offers none. The effective value is `video.captionsEnabled ?? site.captionsDefault` and the site default is true unless a Super admin changes it. When effective value is off the viewer gets no caption tracks and no CC button for that video (M11-S01 Empty already hides the button when there are no tracks). Admin can still generate, edit and approve tracks; switching back on needs no reprocessing. Turning a video to off needs a reason (5 or more characters, same rule as the caption override) because an explicit off satisfies the publish gate (M15-S10): the video can publish without approved captions and the audit row records "Captions switched off" with the reason. Editors cannot change it.

Files: migration (below); `packages/db/src/schema/content.ts` (two columns); `packages/catalog/src/admin/captions-availability.ts` (new: `setCaptionsAvailability`, `setCaptionsAvailabilityMany`, `effectiveCaptionsEnabled(video, siteDefault)` pure); `packages/catalog/src/admin/publish.ts` (gate treats effective off as satisfied); `packages/video/src/playback/service.ts` (tracks list empty when effective off); `apps/web/src/server/data/real-playback.ts` (`captions: []` when off); `apps/web/src/lib/data/admin/site-settings.ts` (key `captions.defaultAvailable`, boolean, default true, changeable only with `settings.flags`); `apps/web/src/lib/data/admin/types.ts` (`captionsEnabled`, `captionsOffReason` on `VideoRecord`; `captionsAvailable` on `CaptionRow`); `services.ts`, `real/videos.ts`, `store.ts` fixtures; `VideoEditor.tsx` (new "Captions for viewers" switch card under the status panel, three choices: Follow site default (shows what that is now), On, Off with required reason); `components/admin/site/SiteSettingsView.tsx` (row "Captions are available to viewers by default"); `can.ts`; `apps/web/src/app/admin/(shell)/videos/[id]/actions.ts`.

Migration `packages/db/migrations/main/NNNN_video_captions_switch.sql` (next free number at build, today 0036; generated with `pnpm --filter @ad/db db:generate`, additive, no backfill needed):

```sql
ALTER TABLE videos ADD COLUMN captions_enabled boolean;
ALTER TABLE videos ADD COLUMN captions_off_reason text;
ALTER TABLE videos ADD CONSTRAINT videos_captions_off_has_reason
  CHECK (captions_enabled IS DISTINCT FROM false OR char_length(captions_off_reason) >= 5);
```

Existing rows are `NULL`, which means "follow the site default", so nothing changes for current videos. The worker role already has DML on `videos`. Update DATA-MODEL.md section for `videos` with both columns. Reversible: yes (drop columns).

Tests first:
- `packages/catalog/src/admin/captions-availability.test.ts`: "null follows the site default", "explicit on beats a site default of off", "explicit off beats a site default of on", "turning off without a reason is refused", "an editor cannot change availability".
- `packages/catalog/src/admin/captions-availability.int.test.ts`: "the check constraint rejects off without a reason", "switching off writes an audit row with the reason", "bulk switch reports failures per id and writes one bulk.run".
- `packages/catalog/src/admin/publish.int.test.ts` (edit): "a video with captions switched off publishes without approved captions", "a video following a site default of off publishes without approved captions", "the gate still blocks when captions are on and unapproved".
- `packages/video/src/playback/service.int.test.ts` (edit): "the session lists no caption tracks when effective captions are off", "approved tracks are listed again after switching back on".
- `apps/web/src/server/data/real-playback.int.test.ts` (edit): "watch data has no captions when off", "kids profile does not force captionsOn when there are no tracks".
- `apps/web/src/lib/admin/can.test.ts` (edit): "caption.availability is admin and caption.approve_bulk is admin".
- `components/admin/VideoEditor.test.tsx` (edit): "shows the captions switch with the site default named", "Off asks for a reason and cannot save without it", "an editor sees the switch disabled with a reason".
- `components/admin/site/SiteSettingsView.test.tsx` (edit): "only a Super admin can change the captions default".

### L3-06 Viewer CC respects availability and stays remembered per profile (item 5, part 2)

Files: `apps/web/src/features/player/WatchClient.tsx`, `packages/player/src/controller.ts` (shortcut `c` is a no op without tracks), `features/player/preferences.ts`, `real-playback.ts`.

The existing behaviour is kept: CC choice is saved per profile through `captionsDefault` (M11-S02), kids profiles default to on. New: when the video offers no captions the CC button is not rendered, the `c` key does nothing, and the profile's saved choice is not changed by watching such a video, so the choice is back on the next video that has captions.

Tests first:
- `features/player/preferences.test.ts` (edit): "watching a video without captions does not change the saved captions choice".
- `packages/player/src/controller.test.ts` (edit): "the c key does nothing when there are no tracks", "the c key toggles when a track exists".
- `features/player/WatchClient.test.tsx` (edit or new): "no CC button when captions are unavailable", "CC button remembers on for the next video", "a kids profile starts with captions on when a track exists and shows no button when it does not".
- `components/title` card tests for the CC badge (M11-S05): "the badge is hidden when captions are switched off".

Migrations: none.

### L3-07 Captions: selection and bulk approve (item 4)

Files: `CaptionList.tsx` becomes a thin server wrapper around new client `CaptionTable.tsx` (selection, bar, stacked mobile cards, uses `adm-actions`); `caption-commands.ts` (`planBulkApprove`, `approveMany`, `isUntouchedAuto`); `lib/data/admin/services.ts` and `real/captions.ts`; `packages/catalog/src/admin/captions.ts` (`approveCaptionTracks` in one pass per id, one audit row per track with `extra.bulkId`, one `bulk.run`); `app/admin/(shell)/captions/actions.ts` (`bulkApproveCaptionsAction`); `CaptionRow` gets `untouchedAuto: boolean`, `warnings: number`; `captions/page.tsx` accepts `?edited=never` and `?state=` filters.

Rules (decision L3-D09). Selected rows are split by `planBulkApprove`:

| Row | Result |
|---|---|
| state `needs_review`, no warnings | eligible |
| eligible and untouched auto (source whisper, never opened or edited: `isUntouchedAuto`) | eligible but counted in the warning |
| state `needs_review` with validation warnings (overlap, empty cue, cue over 7 s: M15-S07 AC2) | skipped, reason "Has warnings. Open it to review." |
| state `failed` | skipped, reason "Captions failed. Retry or upload a file." |
| state `generating` | skipped, "Still being made." |
| state `none` | skipped, "No captions yet." |
| state `approved` | skipped, "Already approved." |

The bar button reads "Approve 9" (count of eligible) with the skipped count beside it ("3 will be skipped"). The confirm dialog (S105) shows the count, the breakdown, and, when `untouchedAuto > 0`, a warning panel: "4 of these were made by the computer and nobody has opened or edited them. Auto captions can get names, places and numbers wrong." with a required checkbox "I understand and approve them anyway" and a link "Show those 4 first" (sets the filter `?edited=never`, keeps the selection of those rows). Approval goes through the same service as single approve, so versions are stored and VTTs are published one by one; a publish failure on one track leaves that track unchanged and lists it as failed (M15-S07 Error). No undo (L3-D07). Role: `caption.approve_bulk` (admin).

Tests first:
- `lib/data/admin/caption-commands.test.ts` (edit): "planBulkApprove skips failed, generating, none and approved rows with reasons", "planBulkApprove skips needs_review rows that have warnings", "isUntouchedAuto is true for a whisper track nobody edited", "isUntouchedAuto is false after any cue edit", "approveMany approves each eligible track and leaves skipped ones unchanged", "approveMany refuses a role below admin".
- `components/admin/CaptionTable.test.tsx` (new): "button shows the eligible count and the skipped count", "dialog shows the breakdown", "acknowledgement is required when untouched auto captions are included", "Show those first applies the edited=never filter", "results report lists skipped and failed rows with reasons", "no Undo is offered", "Cues column is right aligned in header and cells", "mobile cards show state, cue count and a Review button".
- `packages/catalog/src/admin/captions.int.test.ts` (edit): "bulk approve stores a version and an audit row per track", "one failed publish leaves that track needs_review and the rest approved", "an editor is denied and audited".
- `app/admin/(shell)/captions/captions.route.test.ts` (new): "the action rejects more than 200 ids", "filter edited=never lists only untouched auto tracks".

Migrations: none (untouched is derived from `captions.source = 'whisper'` and `captions.revision = 1` on the track's current draft, no new column).

### L3-08 Captions availability in bulk, on the Videos list

Files: `VideosList.tsx` (menu "Captions for viewers": On, Off, Follow site default), `video-queries.ts` (`captions_available` action wired to `setCaptionsAvailabilityMany`), result and undo through the core. Off in bulk asks for one reason applied to all and is `caption.availability` (admin). All matching scope is allowed (L3-D05).

Tests first: `VideosList.test.tsx`: "Captions for viewers appears for admins and is disabled with a reason for editors", "Off in bulk requires one reason", "bulk off reports failures per video", "undo restores previous tri state per video". `video-queries.test.ts`: "captions_available applies a tri state to every id and returns the previous values".

### L3-09 Encoding and Failed encodes: bulk retry

Files: `EncodingQueue.tsx` (checkbox only on failed rows; running rows get none; bar "Retry 4 failed"), `FailedEncodes.tsx` (select rows; bar with Retry n and Clean up n, existing "Clean up all" stays), `video-commands.ts` (`retryEncodeMany`), `real/videos.ts`, `packages/catalog` (`retryAdminVideos`), `app/admin/(shell)/videos/actions.ts` (`bulkRetryEncodesAction`, `bulkCleanupFailedAction`).

Rules (L3-D10): retry only rows where `canRetry` (original file still stored); others are skipped with "The original file was removed. Replace the file instead." Jobs are queued oldest failure first and run one after another (concurrency 1, M14-S07), and the dialog says so with the count. While a bulk dialog is open or a selection exists, live polling keeps running (rows update) but the selection is by id so it survives; a retried row leaves the failed set and drops out of the selection. A success toast says "4 are back in the queue."

Tests first:
- `video-commands.test.ts` (edit): "retryEncodeMany retries failed rows and skips others with a reason", "a row without its original is skipped", "order is oldest failure first".
- `EncodingQueue.test.tsx`: "only failed rows have a checkbox", "bar shows Retry with the failed count", "selection survives a live refresh", "selection drops rows that were retried", "partial result lists skipped rows".
- `FailedEncodes.test.tsx` (new): "Retry and Clean up work on the selection", "Clean up all still works with nothing selected", "bar shows how many have leftover files".
- `packages/catalog` int test: "bulk retry audits one video.retry per job with the bulkId", "a role below editor is denied".

### L3-10 Trash: restore and delete forever in bulk

Files: `TrashList.tsx` (selection, stacked mobile cards, bar: Restore n, Delete forever n; header "Select all"), `video-commands.ts` (`restoreMany`, `purgeMany`), `real/videos.ts`, catalog (`restoreAdminVideos`, `requestPurgeAdminVideos`), actions in `videos/actions.ts`.

Rules (L3-D13): Restore returns videos as Draft (M16-S06 AC2) and is undoable by re-trashing. Delete forever uses `TypedConfirmDialog`: the person types the count ("Type 7 to delete 7 videos forever"), single delete types the word "delete"; needs `video.purge` (admin). Purge is queued per video (R2 deletion retries, M16-S06 Error), so the report can show "queued for deletion" per id and failures per id. Trash page loads up to 200 rows, oldest deleted first, so select all means all rows shown.

Tests first:
- `video-commands.test.ts` (edit): "restoreMany returns each to Draft", "purgeMany refuses below admin per id", "purgeMany leaves videos not in Trash as failed with a reason".
- `TrashList.test.tsx` (new): "Delete forever stays disabled until the count is typed", "Restore n shows an Undo", "editors can restore but not delete", "empty state is Trash is empty", "mobile cards replace the table", "Days left column is numeric in header and cells".
- catalog int: "bulk purge writes video.purge per video and one bulk.run", "restore then undo is idempotent".

### L3-11 Series: bulk publish, unpublish, delete

Files: `SeriesList.tsx` (selection on cards; bar: Publish, Unpublish, Delete), `collection-commands.ts` (`bulkSeries`), `real/collections.ts`, catalog series (`bulkAdminSeries`), `app/admin/(shell)/series/actions.ts`, `can.ts` (`series.delete`).

Rules (L3-D12): publish and unpublish follow the series visibility rule (M28-S06) per id and are undoable. Delete is page scope only, typed count, no undo, consequence text: "The series and its seasons are removed. The videos stay in the library as single videos." It reuses `deleteAdminSeries` per id. There is no series Trash because delete also removes seasons; adding it is a schema change left out (reversible later).

Tests first:
- `collection-commands.test.ts` (edit): "bulk publish skips a series with no published episode with a reason", "bulk delete detaches episodes and removes the series", "delete is refused for editors", "unpublish undo restores the published state".
- `SeriesList.test.tsx` (new): "cards have checkboxes and a bar", "Delete needs the count typed", "consequence text says the videos stay", "editors see Delete disabled with a reason".
- catalog int: "series bulk delete writes series.delete per id and one bulk.run".

### L3-12 Viewer accounts: bulk support actions

Files: `UsersTable.tsx` becomes a server wrapper around client `UsersTableClient.tsx` (selection only; the search and status filter stay a plain GET form, so the page still works without scripts, M25), stacked mobile cards, `users-commands.ts` (`bulkUserAction`), `real/people.ts`, `app/admin/(shell)/users/actions.ts`.

Actions (admin): Suspend (one shared reason, 3 or more characters per `reasonOk`, applied to all), Reinstate, Force sign out, Resend verification (skips verified accounts: "Already verified"; skips accounts emailed in the last hour: "Sent less than an hour ago"). No bulk delete (M27-S03 AC3). Safeguards: the acting account is never targeted (server removes it; the UI shows the row greyed "You"); suspended accounts are skipped by Suspend with "Already suspended"; the selection is page scope only (L3-D05); an Analyst or Editor cannot see the checkboxes (emails are masked for Editor, M27-S01); max 50 accounts per bulk call here (lower than the shared 200 because each action touches sessions or sends email). Each item writes its normal audit row with the reason and `bulkId`.

Tests first:
- `users-commands.test.ts` (edit): "bulk suspend requires a reason of 3 or more characters", "the actor is skipped even when included", "already suspended accounts are skipped", "bulk resend skips verified accounts and recent sends", "bulk force sign out ends sessions for each and audits each", "more than 50 ids are refused".
- `UsersTableClient.test.tsx` (new): "checkboxes are hidden for roles below admin", "Suspend dialog asks for one reason", "own account row cannot be selected", "report lists skipped accounts with reasons", "Profiles column is numeric in header and cells".
- people int: "an editor forging a bulk suspend is denied and audited".

### L3-13 Staff and invites: bulk role, disable, resend invite

Files: `RolesInvites.tsx` (checkboxes on staff rows and on pending invites; bar), `users-commands.ts` (`bulkChangeRole`, `bulkDisableStaff`, `bulkResendInvites`), `real/people.ts`, `app/admin/(shell)/roles/actions.ts`.

Rules (L3-D11):
- Super admin only (`roles.bulk`), recent re-auth required once for the batch (existing `ReauthDialog`, `reauth: true` result).
- Role change in bulk is limited to Editor and Admin as the new role and to targets that are Editor or Admin now. Moving anyone to or from Super admin is single only (M12-S06). This removes the "last Super admin" bulk path; the server still enforces the last Super admin guard (never leave zero) as a second line.
- Disable (remove admin access, ends admin sessions at once per M12-S06 AC2) in bulk: all or nothing, so a mistake does not half apply; refused if the batch includes a Super admin, the actor, or would leave zero Super admins ("There must be at least one Super admin").
- Self is never a target (greyed row "You").
- Resend invite works on pending invites only, skips invites revoked or accepted, skips invites resent in the last hour, caps at 20 per batch.
- Every item audited with old and new role; one `bulk.run`.

Tests first:
- `users-commands.test.ts` (edit): "bulk role change refuses a batch that includes the actor", "bulk role change refuses moving anyone to or from super admin", "bulk disable refuses a batch with a super admin", "bulk disable is all or nothing", "the last super admin guard still holds server side", "bulk resend skips recent and accepted invites", "bulk resend caps at 20", "audit rows carry old and new role and the bulkId".
- `RolesInvites.test.tsx` (edit): "checkboxes appear only for a Super admin", "own row is locked with the reason", "role change asks for re-auth once", "refusal message is shown for the last Super admin".
- `packages/auth/src/super-admin.int.test.ts` (edit): "an admin forging a bulk role change is denied in the service and in SQL".

### L3-14 Bulk upload: shared details form

Files: `UploadScreen.tsx` (new `UploadDetailsForm.tsx`, `upload-details.ts`), `UploaderContext.tsx` (carries details with each lane), `lib/uploader` (lane meta), `registerUploadAction` and the real upload service (accept `details`), `lib/data/admin/video-commands.ts` (validate details with `validateVideoPatch` rules), `app/admin/(shell)/videos/actions.ts`.

Shared details (applied to every file in the batch): Category (multi select, same categories as the editor), Series (with optional "number episodes in file order starting at [n]", off by default), Suitability (Everyone, Kids, Older viewers; blank means not set and the publish checklist will ask), Tags (optional). "Publish later" is slice L3-16. The form sits above the queue, collapsed to one line once files are added ("Details for all 8 files: Science, Series X, Everyone. Edit"). Changing the form later affects only files not yet registered; files that are already uploaded show "Details were saved with the draft".

Tests first:
- `upload-details.test.ts`: "resolveDetails merges shared details with a file override", "series auto numbering follows file order", "invalid category ids are dropped with an error", "details never apply to a replace upload".
- `UploadScreen.test.tsx` (new or edit): "shows the shared details form before and after adding files", "files added after a change use the new details", "the summary line names the count and the choices", "replace mode hides the form".
- `UploadLane.test.tsx` (edit): "a lane carries its details to register".
- `video-commands.test.ts`: "createFromUpload applies category, series, suitability and tags to the draft".
- `packages/video/src/upload/service.int.test.ts` (edit): "the draft is created with the supplied details and an audit row".

### L3-15 Bulk upload: per file override table

Files: new `UploadOverrides.tsx`, edits to `UploadScreen.tsx` and `UploadLane.tsx`.

A table (stacked cards on phones, `adm-num` for size) with one row per file: file name, Title (editable text, default from the file name cleaned as `createFromUpload` does today), Category, Series and episode number, Suitability, and a Reset button. A cell that differs from the shared form shows a "Custom" badge. Changing the shared form updates every row that has no override for that field. Rows can be edited while the file is waiting or uploading; after registration the cell is read only.

Tests first: `UploadOverrides.test.tsx`: "title defaults from the file name", "an override shows the Custom badge and survives a change to the shared form", "Reset returns to the shared value", "cells become read only after registration", "table headers and size cells follow the alignment rule", "keyboard can edit every cell".

### L3-16 Publish later on upload (Could)

Resolution (L3-D14): "publish later" means "publish by itself when the video is ready", never a way around the caption gate. Choices: Keep as draft (default), or Publish when ready, with an optional "not before" date and time. The video publishes at the moment its last blocker clears (usually captions approved) or at the not before time, whichever is later, if it passes `canPublish` then; if it cannot, it stays a draft and an admin notice says why.

Files: migration `NNNN_video_publish_intent.sql` (`videos.publish_intent jsonb`, check `publish_intent ->> 'mode' IN ('when_ready')`); `packages/catalog` (clear intent on manual publish, evaluate intent when a checklist item completes and from the existing scheduler job in `@ad/queue`); upload details form; video editor shows "Will publish when ready" with Cancel.

Tests first: `publish-intent.test.ts`: "intent publishes when the last blocker clears", "intent waits for the not before time", "intent never bypasses the caption gate", "manual publish clears the intent", "a failed publish leaves a draft and raises a notice"; `publish-intent.int.test.ts`: "migration column rejects an unknown mode", "the scheduler publishes due intents once". Reversible: yes. Permissions: `video.publish` (editor) as for scheduling.

### L3-17 Docs, stories and matrix

Files: `docs/USER-STORIES.md` (module M42 and the edits in section 9, counts table), `docs/MODULES.md` (index row and module section M42), `docs/SECURITY.md` (matrix rows, mismatch fixes), `docs/DESIGN-SYSTEM.md` (11.16 alignment rule, new bulk bar and results panel component entries with states, breadcrumb entry, table mobile rule), `docs/DATA-MODEL.md` (new columns), `docs/DECISIONS.md` (section 11), `docs/audits/stories-admin.md` (rows for M42), `docs/lanes/L3.md` (what exists, routes, scoped test commands, gaps), `CHANGELOG.md`. Not `ai-context.md` (main session).

Tests: `pnpm vitest run apps/web/src/lib/admin/can.test.ts` (matrix and docs agree) and the existing docs lint if any.

## 7. Scoped test commands (per slice, never the full suite)

```
pnpm vitest run apps/web/src/components/admin/admin-css.test.ts apps/web/src/components/admin/tables.test.tsx   # L3-01
pnpm vitest run packages/ui/src/components/Breadcrumbs.test.tsx apps/web/src/app/admin/crumbs-audit.test.ts     # L3-02
pnpm vitest run apps/web/src/lib/data/admin/bulk.test.ts apps/web/src/components/admin/bulk                    # L3-03
pnpm vitest run apps/web/src/lib/data/admin/video-queries.test.ts apps/web/src/components/admin/VideosList.test.tsx  # L3-04, L3-08
pnpm vitest run packages/catalog/src/admin/captions-availability.test.ts apps/web/src/lib/admin/can.test.ts     # L3-05
pnpm vitest run apps/web/src/features/player/preferences.test.ts packages/player/src/controller.test.ts        # L3-06
pnpm vitest run apps/web/src/lib/data/admin/caption-commands.test.ts apps/web/src/components/admin/CaptionTable.test.tsx  # L3-07
pnpm vitest run apps/web/src/components/admin/EncodingQueue.test.tsx apps/web/src/components/admin/FailedEncodes.test.tsx  # L3-09
```

Integration files use `export TEST_DATABASE_ADMIN_URL=postgres://postgres:postgres@localhost:5432/postgres` after `pg_ctlcluster 16 main start`; stop the cluster at the end of the session.

## 8. User stories, module M42 (Admin polish and bulk operations)

Add after M36 in `docs/USER-STORIES.md` and as a section in `docs/MODULES.md` (Area: Admin, Readiness [READY], dependencies M12, M13, M14, M15, M16, M20, M27, M28, M11). Format follows the file.

## M42 Admin polish and bulk operations

### M42-S01 One table alignment rule and padded containers (Must)
As an admin, I want columns lined up the same way on every screen, so that I can scan figures and never see text touching a box edge.
- AC1: Given any admin table, When it renders, Then quantity columns (counts, sizes, durations, percentages, days left, rows) have a right aligned header and right aligned cells with tabular numerals, and text, dates and status columns are left aligned.
- AC2: Given the Captions table, When it renders, Then the Cues header sits directly above the right aligned values.
- AC3: Given the Encoding queue and Failed encodes lists, When they render, Then text, bars and banners keep the card padding and never touch the card border.
- AC4: Given a phone width, When a table has more than four columns, Then it scrolls sideways with the first column fixed, or becomes stacked cards (Captions, Trash, Users), and nothing is clipped.
- Edge: a numeric column that sometimes shows words ("Working", "None") right aligns the words too.
- Error: not applicable.
- Empty: empty tables keep the card padding around the empty state.

### M42-S02 Breadcrumbs line up and fit (Must)
As an admin or viewer, I want the trail above the page title to read as one tidy line, so that I know where I am.
- AC1: Given any page with a breadcrumb, When it renders, Then every crumb, link or current page, sits on the same line at the same height.
- AC2: Given a very long title as the last crumb, When shown on desktop, Then it is cut with an ellipsis (full text on hover and for screen readers) and the heading below is not pushed down.
- AC3: Given a phone width, When a page has two or more crumbs, Then only the parent shows, as a back link of at least 44px, and the full trail stays available to screen readers.
- AC4: Given every admin page, When tested, Then the trail starts with Admin linking to `/admin` and the last crumb is not a link.
- Edge: the viewer title page uses the same component.
- Error: not applicable.
- Empty: a page with one crumb shows it as the current page.

### M42-S03 Select rows and see what is selected (Must)
As an admin, I want to select rows and see a bar with the count and the actions that fit, so that I can change many things in one go.
- AC1: Given a list with bulk actions, When I tick rows, Then a bar shows "N selected", announces the count to screen readers and lists only the actions my role may use; actions I may not use are disabled with the reason.
- AC2: Given I tick the header box, When the page is selected, Then only the rows on the page are selected.
- AC3: Given a phone width, When rows are selected, Then the bar sits at the bottom with the main action visible and the rest under More.
- AC4: Given live updates (Encoding), When the list refreshes, Then my selection is kept, and rows that disappeared are dropped from it.
- Edge: Clear empties the selection and moves focus back to the list.
- Error: not applicable.
- Empty: no selection means no bar.

### M42-S04 Results report and retry failed (Must)
As an admin, I want to see what worked and what did not after a bulk action, so that nothing fails silently.
- AC1: Given a run where every item worked, When it ends, Then a toast says "Action: N done."
- AC2: Given some items failed or were skipped, When it ends, Then a panel lists each with the plain reason and the counts of done, failed and skipped.
- AC3: Given retryable failures (network, timeout, busy), When I press "Retry the N that failed", Then only those run again and the panel updates; failures such as permission or not ready are not offered for retry.
- AC4: Given the connection drops partway, When it happens, Then the panel says how many were done before it dropped and offers Continue.
- Edge: Copy list puts titles and reasons on the clipboard.
- Error: a run that fails before changing anything says "Nothing was changed" and keeps my selection.
- Empty: not applicable.

### M42-S05 Progress for large selections (Should)
As an admin, I want to see progress when I change many items, so that I know it is working.
- AC1: Given more than 25 items, When the action runs, Then it runs in chunks of 25 and shows "Done 50 of 120" with a progress bar.
- AC2: Given I press Cancel, When a chunk is in progress, Then the run stops after that chunk and the report says how many were done.
- AC3: Given I go offline, When a chunk cannot be sent, Then the run pauses with a note and resumes when I am back online.
- Edge: the server never accepts more than 200 ids in one call.
- Error: a failed chunk is reported with its ids.
- Empty: not applicable.

### M42-S06 Select across pages (Should)
As an admin, I want to apply a safe change to everything that matches my filter, so that I do not tick page after page.
- AC1: Given a full page is selected and more rows match, When I choose "Select all N that match", Then up to 500 matching items are selected and the bar says so.
- AC2: Given the action is publish, trash, delete forever, approve captions, or any user, staff or series delete, When rows match across pages, Then the option is not offered.
- AC3: Given the filter changes, When I change it, Then the selection clears.
- Edge: if more than 500 match, the bar says the first 500 are used.
- Error: items that changed since the filter ran are reported per item.
- Empty: not applicable.

### M42-S07 Undo for reversible bulk actions (Should)
As an admin, I want a short Undo after a bulk change, so that a slip costs nothing.
- AC1: Given a reversible action completed, When the toast shows, Then Undo is available for 10 seconds.
- AC2: Given I press Undo, When it runs, Then only the items still in the state the action left them in are reverted, and the result is reported like any bulk run.
- AC3: Given an action that cannot be undone (approve captions, delete forever, retry encodes, staff changes), When it completes, Then no Undo is shown and the confirm dialog said so.
- Edge: Undo is checked against the same permissions as the action.
- Error: items that cannot be reverted are listed.
- Empty: not applicable.

### M42-S08 Bulk approve captions (Must)
As an admin, I want to approve many caption tracks at once, so that a backlog does not take hours, without letting unchecked text through by accident.
- AC1: Given selected tracks, When I open Approve, Then I see how many will be approved and how many will be skipped (failed, still generating, none, already approved, or with warnings), each with its reason.
- AC2: Given some tracks were made by the computer and never opened or edited, When I confirm, Then the dialog warns that auto captions can get names, places and numbers wrong, offers "Show those first", and needs a tick before it approves them.
- AC3: Given I confirm, When it runs, Then each track is approved through the normal approval (version stored, VTT published, audit row) and a failure on one leaves only that track unchanged.
- AC4: Given an Editor, When they select tracks, Then bulk approve is disabled with "Only an admin can approve captions in bulk" while single approval still works.
- Edge: tracks with validation warnings are never bulk approved; they are opened one at a time.
- Error: a publish failure lists that track with the reason and a Retry.
- Empty: no eligible tracks disables the button and says why.

### M42-S09 Bulk retry encodes (Must)
As an admin, I want to retry all failed encodes at once, so that a bad night does not need many clicks.
- AC1: Given failed jobs on Encoding or Failed encodes, When I select them and press Retry, Then each job with its original file goes back in the queue, oldest failure first.
- AC2: Given a job whose original file was removed, When included, Then it is skipped with "Replace the file instead".
- AC3: Given the confirm dialog, When shown, Then it says the jobs run one after another.
- AC4: Given Failed encodes, When rows have leftover files, Then Clean up works on the selection as well as on all.
- Edge: running and queued jobs have no checkbox.
- Error: a job that cannot be queued is listed with its reason.
- Empty: with no failed jobs the bar and checkboxes do not appear.

### M42-S10 Bulk actions on viewer accounts (Should)
As an admin, I want to handle several viewer accounts at once, so that support is quick when many people have the same problem.
- AC1: Given selected accounts, When I choose Suspend, Then I enter one reason (3 or more characters) that is saved on every account and audit row.
- AC2: Given selected accounts, When I choose Reinstate, Force sign out or Resend verification, Then it runs on each with a confirm that states the count.
- AC3: Given accounts already verified, already suspended, or emailed in the last hour, When included, Then they are skipped with that reason.
- AC4: Given my own account is in the list, When I try to select it, Then it cannot be selected.
- Edge: at most 50 accounts per run; no bulk delete.
- Error: per account failures are listed.
- Empty: no matching accounts shows "No users match." and no checkboxes.

### M42-S11 Bulk actions on staff and invites (Should)
As a Super admin, I want to change several staff roles or resend invites together, so that onboarding a team is quick, with safeguards.
- AC1: Given selected Editors and Admins, When I change their role to Editor or Admin and confirm with re-authentication, Then each changes and is audited with the old and new role.
- AC2: Given the batch includes me or a Super admin, or the new role is Super admin, When I try, Then it is refused with the reason and nothing changes.
- AC3: Given I disable several staff, When I confirm, Then it is all or nothing, their admin sessions end at once, and a batch that would leave no Super admin is refused with "There must be at least one Super admin".
- AC4: Given pending invites, When I choose Resend, Then each pending invite not sent in the last hour is resent (at most 20), and accepted or revoked ones are skipped.
- Edge: moving anyone to or from Super admin is only possible one at a time.
- Error: a failed email is listed for that invite.
- Empty: only the Super admin listed means no checkboxes.

### M42-S12 Bulk actions on series (Should)
As an admin, I want to publish, unpublish or delete several series at once, so that housekeeping is quick.
- AC1: Given selected series, When I publish or unpublish, Then each follows the series visibility rule and failures list their reason; Undo is offered.
- AC2: Given selected series, When I delete, Then I must type the count, the dialog says the videos stay as single videos, and no Undo is offered.
- AC3: Given an Editor, When they select series, Then Delete is disabled with "Only an admin can delete a series".
- Edge: delete is page scope only.
- Error: per series failures are listed.
- Empty: "No series yet."

### M42-S13 Restore and delete forever in bulk from Trash (Must)
As an admin, I want to restore or permanently delete many trashed videos, so that Trash does not pile up.
- AC1: Given selected videos in Trash, When I choose Restore, Then they return as Draft with an Undo for 10 seconds that moves them back.
- AC2: Given selected videos, When I choose Delete forever, Then I must type the count to enable the button, and each video is queued for deletion with a result per video.
- AC3: Given an Editor, When they open Trash, Then they can restore but Delete forever is disabled with "Only an admin can delete forever".
- Edge: single Delete forever asks for the word "delete".
- Error: a storage failure on one video retries in the background and is shown as "Queued" with a note.
- Empty: "Trash is empty."

### M42-S14 Upload many files with shared details (Must)
As an admin, I want to set category, series and suitability once for a batch of uploads, so that I do not edit every draft.
- AC1: Given the upload screen, When I add files, Then a details form for all files is shown with Category, Series (with optional numbering in file order), Suitability and Tags.
- AC2: Given I register files, When each draft is created, Then it has the shared details already set.
- AC3: Given I change the shared details, When more files are added, Then new files use the new details and finished ones keep theirs.
- Edge: replacing a failed file never shows the form.
- Error: an invalid choice is explained next to the field and the file waits.
- Empty: before any file is added the form is collapsed with its summary.

### M42-S15 Override details per file (Should)
As an admin, I want to change one file's details without losing the shared ones, so that exceptions are easy.
- AC1: Given files in the batch, When the override table shows, Then each row has Title, Category, Series and episode, Suitability and Reset.
- AC2: Given I change a cell, When it differs from the shared value, Then it shows a Custom badge and later changes to the shared form do not overwrite it.
- AC3: Given I press Reset, When pressed, Then the cell returns to the shared value.
- Edge: after a file is registered its cells are read only.
- Error: an empty title is not accepted.
- Empty: no files means no table.

### M42-S16 Publish later on upload (Could)
As an admin, I want a batch to publish itself when it is ready, so that I am not waiting by the screen.
- AC1: Given I choose "Publish when ready" with an optional not before time, When the video's last blocker clears, Then it publishes if the time has passed and the publish checklist passes.
- AC2: Given captions are not approved, When the time comes, Then the video stays a draft and I get a notice saying why; the caption gate is never skipped.
- AC3: Given I publish by hand, When it happens, Then the intent is cleared.
- Edge: the video editor shows "Will publish when ready" with Cancel.
- Error: a failed automatic publish leaves a draft and a notice.
- Empty: the default is Keep as draft.

### M42-S17 Captions available switch per video (Must)
As an admin, I want to choose whether viewers get captions on a video, so that a title where captions do not fit can go out without them.
- AC1: Given a video, When I open "Captions for viewers", Then I can choose Follow site default (it shows what that is now), On, or Off.
- AC2: Given I choose Off, When I save, Then I must give a reason of 5 or more characters, viewers get no caption tracks and no CC button for it, and an audit row records the reason.
- AC3: Given Off, When the video is published, Then the caption gate counts it as satisfied and the video publishes without approved captions.
- AC4: Given On or Follow with captions in place, When I switch back, Then approved tracks are offered again without reprocessing.
- Edge: Editors see the switch disabled with "Only an admin can change this".
- Error: save failure keeps the old value and shows retry.
- Empty: not applicable.

### M42-S18 Site default for captions (Should)
As a Super admin, I want one site wide default for caption availability, so that I do not set it on every video.
- AC1: Given Site settings, When I open "Captions are available to viewers by default", Then I see On (the default) or Off, changeable only by a Super admin.
- AC2: Given the default is Off, When a video follows the default, Then viewers get no captions for it, and videos set to On still do.
- AC3: Given I change it, When saved, Then an audit row records the old and new value and the Videos list shows the effective state per video.
- Edge: changing the default does not touch videos set explicitly.
- Error: save failure keeps the old value.
- Empty: not applicable.

### M42-S19 Captions available in bulk (Should)
As an admin, I want to switch captions on or off for many videos, so that a whole season is quick to set.
- AC1: Given selected videos, When I choose Captions for viewers and then On, Off or Follow site default, Then it applies to each with a report; Off asks for one reason applied to all.
- AC2: Given I select all that match my filter, When I use this action, Then up to 500 are changed, because the change is reversible; Undo restores each video's previous value.
- AC3: Given an Editor, When they select videos, Then the action is disabled with the reason.
- Edge: videos in Trash are not included.
- Error: per video failures are listed.
- Empty: not applicable.

### M42-S20 Viewer CC follows availability and is remembered per profile (Must)
As a viewer, I want the CC button only when there are captions, and my choice remembered, so that it just works.
- AC1: Given captions are switched off or there is no approved track, When the player loads, Then there is no CC button and the C key does nothing.
- AC2: Given I turn captions on for my profile, When I watch another video that has captions, Then they are on, on every device I use that profile on.
- AC3: Given I watch a video without captions, When I move on, Then my saved choice is unchanged.
- AC4: Given a kids profile, When a video has captions, Then they start on; with none, nothing shows.
- Edge: title cards hide the CC badge when captions are switched off.
- Error: a caption file failing to load shows the existing toast and playback continues.
- Empty: not applicable.

### M42-S21 Videos list bulk gaps (Must)
As an admin, I want the Videos bulk bar to meet the same rules as every other list, so that big clean ups are safe.
- AC1: Given 5 or more videos are selected, When I choose Move to Trash, Then I must type the count.
- AC2: Given Publish, When I choose it, Then a confirm shows the count and the first blocker for any video that is not ready, before anything changes.
- AC3: Given I choose Remove from category, When it runs, Then it removes where present and reports the rest as skipped.
- AC4: Given a partial result, When shown, Then I can retry the failed ones (M16-S09 AC2).
- Edge: Add and Remove category, Set suitability and Captions for viewers allow Select all that match.
- Error: a thrown error says "Nothing was changed".
- Empty: not applicable.

### M42-S22 Bulk actions are audited (Must)
As the owner, I want every bulk action in the audit log, so that I can answer who changed what.
- AC1: Given any bulk run, When it finishes, Then one `bulk.run` row records the action, the actor, the counts and the first 50 ids, and every changed item has its normal audit row carrying the same bulk id.
- AC2: Given a denied or forged run, When the server refuses, Then an audit row with outcome denied is written.
- AC3: Given the Audit log screen, When I search a bulk id, Then I see the summary and its item rows.
- Edge: the summary never stores reasons typed for individual accounts beyond the shared reason; email addresses are masked as everywhere else.
- Error: if the summary cannot be written the action still completes and the failure is logged and alerted (M24).
- Empty: not applicable.

Counts table: add `| M42 | 22 |` after M36 and change the totals sentence in MODULES.md to 37 modules ("M37 onward are added by the v2 plan"; if other v2 lanes add M37 to M41 first, the build rebases the table).

## 9. Exact edits to existing stories

Apply in L3-17. Each line is one added or changed line unless stated.

- E1 `M11-S01` Edge: change "Empty: no tracks means no CC button." to "Empty: no tracks, or captions switched off for the video (M42-S17), means no CC button."
- E2 `M11-S02`: add "- AC3: Given a video has no captions, When I watch it, Then my saved caption choice is not changed (M42-S20)."
- E3 `M11-S05`: add "- Edge: the badge is hidden when captions are switched off for the video or the site (M42-S17, M42-S18)."
- E4 `M14-S06`: add "- Edge: failed jobs can be retried together from the queue and from Failed encodes (M42-S09)."
- E5 `M14-S09`: add "- AC5: Given failed rows, When I select them, Then I can retry them in bulk and see a result per job (M42-S09)." and change AC4 to "Given an Editor, When they open it, Then they see jobs and can Retry one or many but not change worker settings."
- E6 `M15-S03`: add "- AC4: Given the list, When I select tracks, Then I can bulk approve eligible ones (Admin role), filter by 'never edited', and see the Cues column right aligned over its values (M42-S01, M42-S08)."
- E7 `M15-S07`: add "- Edge: bulk approval skips tracks with validation warnings and asks for an acknowledgement when auto captions were never edited (M42-S08)."
- E8 `M16-S06`: change the Edge line to "- Edge: an Admin or Super admin can Delete forever with a typed confirmation (the word delete for one video, the count for several, M42-S13)." and add "- AC4: Given selected videos in Trash, When I choose Restore or Delete forever, Then it applies to all with a result per video (M42-S13)."
- E9 `M16-S09`: change AC2 to "Given an error on some items, When it completes, Then I see which failed with the reason and can retry the retryable ones (M42-S04)."; change the Edge line to "- Edge: moving 5 or more videos to Trash needs typing the count; select all that match is offered only for category, suitability and captions changes (M42-S06, M42-S21)."; add "- AC3: Given Remove from category and Captions for viewers, When chosen, Then they apply to the selection like Add category (M42-S19, M42-S21)."
- E10 `M15-S10`: add "- Edge: a video whose captions are switched off by an Admin (or following a site default of off) counts as meeting the gate, and the reason is audited (M42-S17)."
- E11 `M13-S09`: add "- AC3: Given shared details were set for the batch, When the draft is created, Then it already has category, series, suitability and tags (M42-S14)."
- E12 `M13-S03`: add "- Edge: each file can override the shared details before it registers (M42-S15)."
- E13 `M16-S04`: add "- AC3: Given selected series, When I publish, unpublish or delete them, Then it follows M42-S12."
- E14 `M27-S03`: add "- Edge: several viewer accounts can be handled together with the same safeguards and a shared reason (M42-S10)."
- E15 `M12-S06`: add "- Edge: roles can change in bulk only between Editor and Admin, only by a Super admin with re-authentication, never for myself or to or from Super admin (M42-S11)."
- E16 `M20-S01`: add "- Edge: a bulk run writes one `bulk.run` summary row plus each item's normal row with the same bulk id (M42-S22)."
- E17 `M12-S04`: add "- Edge: the matrix includes caption.availability, caption.approve_bulk, series.delete, users.bulk and roles.bulk (M42)."

## 10. Mockup list (S100 to S109)

New files in `/home/claude/ad/project/` (the `.dc.html` mockup set), named `S10N_<slug>.dc.html` and `S10N_<slug>_m.dc.html` for phone variants. Desktop first at 1280 and 1440 widths; phone at 390. All use real tokens, the existing admin shell and copy rules (no dashes, plain words).

| No | Name | Desktop | Phone | Content and states |
|---|---|---|---|---|
| S100 | Lists and tables: padding and alignment | yes | yes | Before and after side by side: Encoding queue card (padding), Captions table with Cues aligned, Trash, Users. Phone: stacked cards for Captions, Trash, Users and a sideways scrolling table with a fixed first column (Audit log). States: default, hover row, empty table inside padded card. |
| S101 | Breadcrumbs | yes | yes | Encoding (two crumbs), Captions review with a 120 character title (ellipsis), Video editor (three crumbs), viewer title page. Phone shows parent back link only. Focus ring on a crumb link. |
| S102 | Selection bar | yes | yes | Bar anatomy with count, actions, Clear; page selected state with "Select all 48 that match"; all matching selected with the 500 note; disabled action with reason on focus; phone docked bottom bar with More menu open. |
| S103 | Confirm dialogs | yes | yes | Standard confirm with count; typed confirmation (type 7); acknowledgement tick (auto captions warning); shared reason field for Suspend; busy state; focus ring. |
| S104 | Results, progress, undo | yes | yes | Success toast with Undo and countdown; partial failure panel with reasons, Retry the 2 that failed, Copy list; nothing succeeded; chunk progress "Done 50 of 120" with Cancel; offline pause; interrupted with Continue. |
| S105 | Captions list with bulk approve | yes | yes | Table with checkboxes, edited filter, bar "Approve 9, 3 will be skipped"; approve dialog with breakdown and untouched warning; report with skipped reasons; Editor disabled state; empty "No captions waiting. Nice work."; phone cards. |
| S106 | Encoding queue and Failed encodes bulk retry | yes | yes | Failed rows with checkboxes, running rows without; bar "Retry 4 failed"; confirm saying jobs run one at a time; skipped row with no original; Failed encodes bar with Retry and Clean up; padded card. |
| S107 | Users, Staff, Series, Trash bulk | yes | yes | Four frames: viewer accounts (Suspend with shared reason, own row locked), staff and invites (re-auth, own row locked, last Super admin refusal message, resend invite skipped list), series cards (typed delete with consequence text), Trash (Restore with Undo, Delete forever typed count, editor disabled). |
| S108 | Bulk upload details and per file overrides | yes | yes | Shared details form expanded and collapsed with summary; queue with override table, Custom badge, Reset; publish when ready with not before; states: waiting, uploading, registered (read only), validation error. |
| S109 | Captions on and off | yes | yes | Video editor card (Follow site default, On, Off with reason); Site settings row; Videos bulk menu "Captions for viewers"; viewer player without a CC button, with CC on and remembered; title card with and without the CC badge. States: editor disabled, saving, error. |

Each mockup records its states in a note beside the frame (default, hover, focus, selected, busy, error, empty) as DESIGN-SYSTEM requires. The build opens the existing S48, S49, S54 and S58 mockups to copy layout and copy, then replaces them.

## 11. Decisions to log (append to `docs/DECISIONS.md`)

Format per CLAUDE.md: decision, options, why, reversible.

- L3-D01 Table alignment rule. Options: left everything; right align numbers with right aligned headers (chosen); centre numbers. Why: matches DESIGN-SYSTEM 11.16 and fixes the CSS specificity bug rather than moving headers. Reversible: yes (CSS).
- L3-D02 One breadcrumb component in `@ad/ui`. Options: patch both copies; shared component (chosen). Truncate current page at 40ch on desktop, show only the parent on phones. Why: the defect was a duplicated pattern. Reversible: yes.
- L3-D03 Tables on phones. Options: scroll everywhere; stacked cards everywhere; cards for Captions, Trash, Users and scroll with a fixed first column for wide tables (chosen). Why: DESIGN-SYSTEM 11.16 and one handed use on low end phones. Reversible: yes.
- L3-D04 Bulk mechanics. 25 ids per chunk, 200 per server call, 500 per selection, 50 for account actions, 20 for invites. Options: one big call; chunked (chosen). Why: survive timeouts and slow Lagos connections, show progress, cap blast radius. Reversible: yes (constants).
- L3-D05 Selection across pages. Options: never; always; only for non destructive reversible actions with a filter snapshot (chosen). Why: saves ticking pages without letting someone delete what they cannot see. Reversible: yes.
- L3-D06 Partial failure. Each item succeeds or fails alone, except suitability (already all or nothing, M35-S04) and staff disable (all or nothing, security). Why: one bad row never blocks the rest, but security changes never half apply. Reversible: yes.
- L3-D07 Undo. 10 second toast, client memory only, compare and set on the server, offered for trash, restore, publish, unpublish, category, suitability, captions availability, suspend and reinstate, series publish. Not offered for approve captions, delete forever, retry, staff changes. Why: only where reversal is cheap and safe. Reversible: yes.
- L3-D08 Audit shape. One `bulk.run` row plus every item's normal row with `extra.bulkId`. Options: summary only; items only; both (chosen). Why: the log stays searchable by item and by run. Reversible: yes.
- L3-D09 Bulk approve captions. Admin only; skip failed, generating, none, approved and tracks with warnings; acknowledgement required for untouched auto captions. Options: Editor allowed; block untouched entirely; warn and acknowledge (chosen). Why: Sister Vanessa can clear a backlog, wrong names are not published by accident. Reversible: yes.
- L3-D10 Bulk retry. Only jobs with the original file, oldest first, one at a time, new action `encode.retry` at editor level. Why: matches M14-S07 and M14-S09 AC4. Reversible: yes.
- L3-D11 Users and staff bulk. Viewer accounts: suspend with shared reason, reinstate, force sign out, resend verification, no bulk delete. Staff: Super admin only, re-auth once, Editor and Admin only, never self, never to or from Super admin, disable all or nothing, resend invites with a one hour cooldown. Why: the safest set that still removes repeat clicks. Reversible: yes.
- L3-D12 Series. Bulk publish, unpublish, delete (typed count, no undo, new `series.delete` admin). No series Trash because delete removes seasons and a restore needs a schema change. Behaviour change: editors can no longer delete a series. Reversible: yes (add soft delete later).
- L3-D13 Trash. Bulk restore and delete forever with typed count; purge stays admin and the doc is corrected (M16-S06 said Super admin). Why: docs follow the shipped matrix. Reversible: yes.
- L3-D14 Bulk upload. Shared details with per file overrides; "publish later" means publish when ready with an optional not before time and never bypasses the caption gate. Options: schedule a time (cannot work: nothing is publishable at upload); intent (chosen). Reversible: yes (drop `publish_intent`).
- L3-D15 Captions on and off. Per video tri state, site default (Super admin), Admin changes it with a reason for Off, Off satisfies the publish gate, Off hides tracks and the CC button, admin can still process captions, the profile's saved choice is untouched. Options: a viewer only toggle (exists already); a per video flag only; flag plus site default (chosen, from the audit's resolved option). Note: approved VTT files live on the public media path, so switching off stops them being offered but does not revoke a URL someone already has; captions are not secret. Reversible: yes.
- L3-D16 Doc and code mismatches fixed in docs, not code: encoding retry is editor level; Delete forever is admin level.

## 12. Risks

1. Server action size and timeouts with 200 ids. Mitigation: chunks of 25, per item work, cap 200 server side, progress and Continue.
2. Live polling on Encoding (every 5 s `router.refresh()`) fighting with selection. Mitigation: selection is client state keyed by id, rows that disappear are pruned, polling does not remount the table (covered by "selection survives a live refresh").
3. Race: items change between selection and run. Mitigation: each action rechecks state per id and returns a reason; compare and set for undo.
4. Wrong captions published in bulk. Mitigation: admin only, warnings and untouched acknowledgement, skip rules, one by one approval path, no bulk approval of tracks with warnings; audit per track.
5. Staff lockout (last Super admin, self demotion, mass disable). Mitigation: server guards plus SQL guard, all or nothing disable, Super admin changes single only, re-auth once, tests with forged requests.
6. Email abuse through bulk resend. Mitigation: one hour cooldown per target, 50 and 20 caps, existing mail rate limits (M21).
7. Switching captions off to dodge the review gate. Mitigation: admin only, reason required, audited, visible on the video status panel and in the audit log. Owner can set the site wide `captions_required` (M15-S10) separately.
8. Cached caption URLs after Off. The public `cap/` path stays reachable for anyone with the URL. Accepted, stated in L3-D15.
9. Migration numbering and `DECISIONS.md` conflicts with other lanes. Mitigation: next free number at build, rebase conflicts keep both, renumber L3-D ids.
10. Series delete tightening (`series.delete` admin) surprises editors. Mitigation: disabled button with a reason, noted in the changelog and lane notes.
11. Admin CSS is one 2000 line file touched by many lanes. Mitigation: L3-01 and L3-02 are small and merge first; new bulk CSS goes in its own block (`.adm-bulk*`), not scattered.
12. `Breadcrumbs` moving into `@ad/ui` touches the viewer title page. Mitigation: only the markup and alignment change; the visibility breakpoint stays; the existing `TitleView` test keeps passing.
13. Mobile bottom bar overlapping iOS safe area or the on screen keyboard in the typed confirm. Mitigation: `env(safe-area-inset-bottom)`, dialog (not the bar) hosts the typed input, tested in the Playwright mobile pass.
14. Progressive enhancement: Users and Captions lists render server side and work without scripts today. Mitigation: selection and bars are an added client island; search, filters and links keep working with no script.

## 13. Owner questions

None block the build. Two choices are worth a glance because they change who can do what, both already set to the recommended option and easy to reverse: (a) bulk approve of captions is Admin only, so an Editor still approves one at a time; (b) deleting a series becomes Admin only (it is Editor today).

## 14. Amendments (design review, 24 November 2026)

Review: `docs/reviews/v2/L3-review.md`. Where this section and an earlier section disagree, this section wins (rulings R21, R22, R30, R32, R33, R38 apply). The CSS below replaces the blocks it names.

### 14.1 Breadcrumb CSS (replaces section 3.3 block, R30 and R32)

Changes: links get `min-width: 44px` and centre their text; the current crumb is `display: inline-block` with `line-height: 44px` (an inline-flex box ignores `text-overflow: ellipsis`, so the cut never showed); the phone back link keeps the 44px box.

```css
.ad-crumbs ol { display: flex; flex-wrap: wrap; align-items: center; margin: 0; padding: 0; list-style: none; color: var(--color-muted); font-size: var(--text-caption); }
.ad-crumbs li { display: inline-flex; align-items: center; min-width: 0; min-height: var(--touch-target); }
.ad-crumbs li + li::before { content: '/'; flex: none; padding: 0 var(--space-2); }
.ad-crumbs a { display: inline-flex; align-items: center; justify-content: center; min-width: var(--touch-target); min-height: var(--touch-target); line-height: var(--leading-normal, 1.5); color: var(--color-muted); }
.ad-crumbs [aria-current='page'] { display: inline-block; min-width: 0; max-width: 40ch; line-height: var(--touch-target); color: var(--color-ink); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ad-crumbs--viewer a { color: var(--color-primary); text-decoration: underline; }
```

The phone block, the hover block and the viewer wrapper rule in 3.3 stay as written. Playwright check in the PR: every `a` and `[aria-current]` in a trail measures 44px tall, links at least 44px wide, and the current crumb of a 120 character title measures one line.

### 14.2 Bulk bar CSS (replaces the `.adm-bulk*` description in section 4, R30 and R38)

```css
.adm-bulk { display: flex; flex-wrap: wrap; align-items: center; gap: var(--space-3); min-height: 3.75rem; padding: var(--space-2) var(--space-4); border-radius: var(--radius-lg); background: var(--color-sidebar-bg); color: var(--color-sidebar-ink); box-shadow: var(--shadow-3); }
.adm-bulk__count { font-weight: 700; white-space: nowrap; }
.adm-bulk__note { color: var(--color-sidebar-muted); font-size: var(--text-caption); }
/* Select all N that match: a 44px high link, never a bare inline link (R30) */
.adm-bulk__all { display: inline-flex; align-items: center; min-height: var(--touch-target); padding: 0 var(--space-1); color: var(--color-focus-ring-dark); font-weight: 600; text-decoration: underline; white-space: nowrap; }
/* Disabled bar action uses tokens, not raw greys (R38). Keeps aria-disabled so it stays focusable and shows its reason. */
.adm-bulk .ad-btn[aria-disabled='true'] { background: var(--color-sidebar-active); border-color: var(--color-sidebar-active); color: var(--color-sidebar-muted); cursor: not-allowed; }
.adm-bulk :focus-visible { outline: 3px solid var(--color-focus-ring-dark); outline-offset: 2px; }
```

Measured: disabled text `--color-sidebar-muted` on `--color-sidebar-active` 5.86:1; note text on the bar 7.98:1; yellow link on the bar 11.55:1. The disabled edge is 1.36:1 against the bar, which WCAG exempts for inactive controls; the word and the reason on focus carry the meaning.

### 14.3 Locked row spacer (R33)

A row that cannot be selected (own account, a Super admin, a running job) shows no checkbox and no greyed box. The cell keeps a 20px wide empty spacer inside the normal 44px cell so text stays aligned with selectable rows, and the row states its reason in plain words under the name (for example "You cannot select your own account").

```css
.adm-select-spacer { display: block; flex: none; inline-size: 1.25rem; block-size: 1.25rem; }
```

The cell is `aria-hidden`; the reason text is real text in the row, so nothing relies on a disabled control.

### 14.4 Switch hit area (R30)

The switch (`role="switch"`) is a 44px high button; the 26px track is drawn inside it.

```css
.ad-switch { position: relative; inline-size: 2.75rem; block-size: var(--touch-target); flex: none; background: transparent; border: 0; }
.ad-switch::before { content: ''; position: absolute; inset-inline: 0; top: 0.5625rem; block-size: 1.625rem; border-radius: 0.8125rem; background: var(--color-switch-off); }
.ad-switch::after { content: ''; position: absolute; top: 0.75rem; inset-inline-start: 0.1875rem; inline-size: 1.25rem; block-size: 1.25rem; border-radius: 50%; background: var(--color-surface); }
.ad-switch[aria-checked='true']::before { background: var(--color-primary); }
.ad-switch[aria-checked='true']::after { inset-inline-start: 1.3125rem; }
@media (prefers-reduced-motion: no-preference) { .ad-switch::after { transition: inset-inline-start var(--duration-fast) var(--ease-standard); } }
```

### 14.5 Links inside lists, tables and reports (R30)

Any link in a table cell, report row or card list is `display: inline-flex; align-items: center; min-height: var(--touch-target)`. Report rows use `padding: 0 var(--space-3); min-height: var(--touch-target)`. The admin brand link in the sidebar header is also 44px high. Admin nav links already use `min-height: var(--touch-target)`; the build adds a Playwright check that every `.adm-nav a` measures 44px at 360, 390 and 1360 (R30).

### 14.6 Colour tokens still to add (decision L3-D15)

The mockups use four text inks on status tints that are not in `tokens.css`. Add them to `tokens.css`, DESIGN-SYSTEM section 3 and the Fixed group of the theme editor: `--color-info-ink: #14568F` (6.63:1 on `--color-info-tint`), `--color-success-ink: #14532D` (7.99:1 on `--color-success-tint`), `--color-warning-ink: #5E3D00` (8.88:1 on `--color-warning-tint`). Danger text on a tint uses the existing `--color-danger-ink` (#8F1D13, 7.8:1); the mockup value #8E1B12 was a near duplicate and is replaced.

### 14.7 Rulings applied to this plan

- R21: bulk approve of captions and series delete are Admin only. Section 5 already says so; the Editor disabled states in S105 and S107 carry the reason text.
- R22: captions per video are On, Off or Follow site default, changed by an Admin only. Off hides CC and keeps every profile's saved choice (S109 viewer frame). The site default stays Super admin only (M42-S18, unchanged).
- R34 applies to the S109 player frame: the seek rail uses `#6A6E78` (3.75:1 on the player surface) inside a 44px hit area.
