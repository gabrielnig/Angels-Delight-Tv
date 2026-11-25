import { SHORTCUT_HELP } from '@ad/player';
import { CAPTION_BADGES, STATUS_BADGES } from '@/components/admin/Badge';
import { DONATION_STATUS_LABELS } from '@/components/admin/DonationsView';
import { NAV_ITEMS } from '@/components/admin/nav';
import { PREVIEW_STATES } from '@/components/admin/PreviewClipCard';
import { ADMIN_ACTIONS, requiredRole, type AdminAction } from './can';

/**
 * The generated parts of the reference guides R02 (roles and permissions), R03 (screen map), R05 (player keys) and
 * R06 (status words). Every list is built from the real tables (the permission table, the side menu, the badge and
 * label maps), and the words people read live in the tables below. A test fails when the code gains an action,
 * screen or status that has no words here, or when an article no longer matches. To rewrite the articles:
 *   KB_WRITE_REFERENCE=1 pnpm vitest run apps/web/src/lib/admin/help-reference.test.ts
 */

type Role = ReturnType<typeof requiredRole>;

const WHO: Record<Role, string> = {
  editor: 'Editors, Admins and Super admins',
  admin: 'Admins and Super admins',
  super_admin: 'Super admins only',
};

/** Plain names of every permission action. A new action in `can.ts` fails the test until it is named here. */
export const ACTION_NAMES: Record<AdminAction, string> = {
  'admin.access': 'Open the admin area',
  'video.upload': 'Upload videos',
  'video.edit': 'Edit video details and use the Encoding queue',
  'video.markers': 'Set skip and chapter marks',
  'video.publish': 'Publish, schedule and unpublish a video',
  'video.restore': 'Restore a video from Trash',
  'video.delete': 'Move a video to Trash',
  'video.purge': 'Delete a video from Trash for good',
  'caption.review': 'Review, edit and approve captions',
  'caption.override': 'Publish a video without approved captions, with a reason',
  'caption.approve_bulk': 'Approve the captions of many videos at once',
  'caption.translate': 'Add and edit caption translations',
  'caption.publish_language': 'Show a caption language to viewers',
  'caption.availability': 'Switch captions off for one video',
  'encode.retry': 'Retry a failed encode',
  'preview.backfill': 'Make preview clips for all videos',
  'series.manage': 'Create and change series and their lessons',
  'series.delete': 'Delete a series',
  'category.manage': 'Create and change categories',
  'home.curate': 'Change and publish the Home page rows',
  'analytics.view': 'See Analytics and make Exports',
  'account.own': 'Manage your own account',
  'users.view': 'See the list of viewers and their details',
  'users.suspend': 'Suspend or reinstate a viewer, sign them out, reset their two step sign in',
  'users.bulk': 'Change many viewers at once',
  'users.delete': 'Delete a viewer account',
  'roles.view': 'See Roles and invites',
  'roles.change': 'Change a staff role and invite staff',
  'roles.bulk': 'Change many staff roles at once',
  'settings.theme': 'Change the Theme',
  'settings.site': 'Change Site settings',
  'settings.flags': 'Change features and limits',
  'audit.read': 'Read the Audit log of content actions',
  'audit.security': 'Read the security part of the Audit log',
  'audit.export': 'Export the Audit log',
  'i18n.edit': 'Edit the site language texts',
  'i18n.approve': 'Approve language texts',
  'i18n.publish': 'Publish language texts',
  'i18n.override': 'Override a locked language text',
  'system.view': 'See the System screen',
  'system.jobs': 'Retry or discard failed jobs on System',
  'sponsor.manage': 'Create and edit sponsors',
  'sponsor.activate': 'Switch a sponsor on',
  'sponsor.report.export': 'Export a sponsor report',
  'donation.view': 'See Donations',
  'donation.export': 'Export Donations',
  'donation.resolve': 'Settle a donation that needs review',
};

/** What each screen is for, by route. Dynamic routes carry the folder names, for example `/admin/videos/[id]`. */
export const SCREEN_PURPOSES: Record<string, [name: string, purpose: string]> = {
  '/admin': ['Dashboard', 'See what needs your attention today.'],
  '/admin/account': ['My account', 'Change your own name, password and two step sign in.'],
  '/admin/analytics': ['Analytics', 'See views and watch time for your videos.'],
  '/admin/analytics/[id]': ['Video numbers', 'See the numbers for one video.'],
  '/admin/audit-log': ['Audit log', 'See who changed what and when.'],
  '/admin/captions': ['Captions', 'Find captions that need review.'],
  '/admin/captions/[videoId]': ['Caption review', 'Read, fix and approve the captions of one video.'],
  '/admin/categories': ['Categories', 'Add, rename, order and hide categories.'],
  '/admin/donations': ['Donations', 'See gifts and their status.'],
  '/admin/donations/[id]': ['One donation', 'Read one gift and settle it when it needs review.'],
  '/admin/encoding': ['Encoding', 'Watch videos being prepared and retry failed ones.'],
  '/admin/encoding/failed': ['Failed encodes', 'See every video that did not finish preparing.'],
  '/admin/exports': ['Exports', 'Download reports and see earlier exports.'],
  '/admin/exports/new': ['New export', 'Choose what to export and start the file.'],
  '/admin/home': ['Home curation', 'Choose the rows on the viewer Home page.'],
  '/admin/invite/[token]': ['Staff invite', 'The page a new staff member opens from an invite email.'],
  '/admin/languages': ['Languages', 'Turn caption and site languages on or off.'],
  '/admin/languages/[locale]': ['Language texts', 'Edit the texts of one language.'],
  '/admin/login': ['Staff sign in', 'Sign in with your email and password.'],
  '/admin/login/2fa': ['Enter your code', 'Enter the 6 digit code from your app.'],
  '/admin/roles': ['Roles and invites', 'Invite staff and set their roles.'],
  '/admin/series': ['Series', 'See and add series.'],
  '/admin/series/[id]': ['One series', 'Change one series and put its lessons in order.'],
  '/admin/site-settings': ['Site settings', 'Change the site name, contact and switches.'],
  '/admin/sponsors': ['Sponsors', 'See sponsors and their status.'],
  '/admin/sponsors/[id]': ['One sponsor', 'Edit one sponsor and its pictures.'],
  '/admin/sponsors/[id]/report': ['Sponsor report', 'Read the report you give a sponsor.'],
  '/admin/sponsors/[id]/report/print': ['Print sponsor report', 'Print or save the sponsor report.'],
  '/admin/sponsors/new': ['New sponsor', 'Add a sponsor.'],
  '/admin/system': ['System', 'Check failed jobs, storage and how playback is doing.'],
  '/admin/theme': ['Theme', 'Change colours, fonts and the look of the site.'],
  '/admin/theme/history': ['Theme history', 'Go back to an earlier look.'],
  '/admin/users': ['Users', 'Find a viewer account.'],
  '/admin/users/[id]': ['One viewer', 'See one viewer and manage the account.'],
  '/admin/videos': ['Videos', 'Find, filter and open your videos.'],
  '/admin/videos/[id]': ['Edit video', 'Edit one video and publish it.'],
  '/admin/videos/[id]/markers': ['Skip and chapters', 'Set skip intro and chapter marks.'],
  '/admin/videos/[id]/poster': ['Poster', 'Choose the poster picture.'],
  '/admin/videos/[id]/preview': ['Preview as viewer', 'Watch a video the way viewers will.'],
  '/admin/videos/trash': ['Trash', 'Restore videos you moved to Trash.'],
  '/admin/videos/upload': ['Upload', 'Add video files.'],
};

/** Plain meaning of every status word. Keys are `group:code`. A new status in the code fails the test until it is explained. */
export const STATUS_MEANINGS: Record<string, string> = {
  'video:draft': 'Not visible to viewers yet. You are still preparing it.',
  'video:uploading': 'The file is still travelling to the site. Keep the page open.',
  'video:processing': 'The site is getting the video ready. This takes a few minutes.',
  'video:needs_captions': 'The video is ready but its captions are not approved yet.',
  'video:ready': 'Everything is done. You can publish it.',
  'video:scheduled': 'It will go live by itself at the time you chose.',
  'video:published': 'Viewers can watch it now.',
  'video:failed': 'Getting the video ready did not finish. Use Retry on Encoding.',
  'caption:none': 'No captions yet.',
  'caption:generating': 'The site is writing the captions. You can leave the page.',
  'caption:needs_review': 'Captions are written. A person must read and approve them.',
  'caption:approved': 'A person checked the captions. Viewers can see them.',
  'caption:failed': 'The captions could not be made. Upload a file or use Regenerate.',
  'preview:none': 'No Home preview clip has been made for this video yet.',
  'preview:queued': 'The clip is waiting its turn to be cut.',
  'preview:ready': 'The clip is made and can play on Home.',
  'preview:failed': 'The clip could not be cut. Home shows the poster. Use Retry.',
  'preview:skipped': 'The video did not suit a clip, such as a very short one. Home shows the poster.',
  'donation:succeeded': 'The gift arrived and was confirmed.',
  'donation:pending': 'The donor started a gift and the payment service has not answered yet.',
  'donation:failed': 'The payment did not go through.',
  'donation:abandoned': 'The donor left before paying.',
  'donation:refunded': 'The money was sent back to the donor.',
  'donation:needs_review': 'We could not confirm this gift. An Admin must check it.',
  'encode:Waiting to start': 'The file is in the queue and has not been picked up yet.',
  'encode:Checking the file': 'The site is checking that the file is a good video.',
  'encode:Making streaming sizes': 'The site is making the smaller copies that play on slow connections.',
  'encode:Final checks': 'The last tests before the video is ready.',
};

const sentence = (text: string) => (/[.]$/.test(text) ? text : `${text}.`);

interface Row {
  key: string;
  label: string;
}

const videoRows = (): Row[] =>
  Object.entries(STATUS_BADGES).map(([code, b]) => ({ key: `video:${code}`, label: b.label }));
const captionRows = (): Row[] =>
  Object.entries(CAPTION_BADGES).map(([code, b]) => ({ key: `caption:${code}`, label: b.label }));
const previewRows = (): Row[] =>
  Object.entries(PREVIEW_STATES).map(([code, s]) => ({ key: `preview:${code}`, label: s.word }));
const donationRows = (): Row[] =>
  Object.entries(DONATION_STATUS_LABELS).map(([code, s]) => ({
    key: `donation:${code}`,
    label: s.label,
  }));
/** The stages the Encoding queue shows under a title, in order (EncodingQueue `stageOf`). */
export const ENCODE_STAGES = ['Waiting to start', 'Checking the file', 'Making streaming sizes', 'Final checks'];
const encodeRows = (): Row[] => ENCODE_STAGES.map((s) => ({ key: `encode:${s}`, label: s }));

/** Every status key the code can show, for the test that checks the meanings table. */
export function statusKeys(): string[] {
  return [...videoRows(), ...captionRows(), ...previewRows(), ...donationRows(), ...encodeRows()].map((r) => r.key);
}

const GROUP_TITLES: Array<[string, () => Row[]]> = [
  ['Video', videoRows],
  ['Encoding stage', encodeRows],
  ['Captions', captionRows],
  ['Preview clip', previewRows],
  ['Donation', donationRows],
];

const list = (lines: string[]) => lines.map((l, i) => `${i + 1}. ${l}`).join('\n');

/** R02: every permission action with the lowest role that can do it, in the order of the permission table. */
export function renderRoles(): string {
  return list(
    ADMIN_ACTIONS.map((a) => `**${ACTION_NAMES[a]}**: ${WHO[requiredRole(a)]}.`),
  );
}

const navByHref = new Map(NAV_ITEMS.map((n) => [n.href, n]));

/** R03: every admin screen, menu items first with their group, then the screens you reach from inside another. */
export function renderScreens(routes: string[]): string {
  const lines = routes.map((route) => {
    const [name, purpose] = SCREEN_PURPOSES[route] ?? [route, ''];
    const nav = navByHref.get(route);
    const where = nav ? ` (side menu, ${nav.group})` : '';
    const link = route.includes('[') ? '' : ` [Open ${name}](${route})`;
    return `**${name}**${where}: ${sentence(purpose)}${link}`.trim();
  });
  return list(lines);
}

/** R06: the words on every badge, grouped by where they appear. */
export function renderStatuses(): string {
  const lines: string[] = [];
  for (const [group, rows] of GROUP_TITLES) {
    for (const r of rows()) lines.push(`${group}, **${r.label}**: ${STATUS_MEANINGS[r.key] ?? ''}`);
  }
  return list(lines);
}

/** Keys of the admin area, hand written and checked by the fact checker rules (one action each). */
export const ADMIN_KEYS = [
  'Press **Tab** to move to the next button, link or field, and **Shift and Tab** to go back.',
  'Press **Tab** once on a new page to reach **Skip to content**, then **Enter** to jump past the side menu.',
  'Press **Enter** or **Space** to use the button or link you are on.',
  'Press **Escape** to close a dialog, a menu or the Help panel.',
  'Press **?** to open the Help panel for the screen you are on.',
  'Press **/** on a Help centre page to jump to the search box.',
  'Press **Left** or **Right**, or **Home** and **End**, to move between tabs in a row of tabs.',
];

/** R05: the admin keys, then the player keys from the same table the player help dialog reads. */
export function renderKeys(): string {
  return list([
    ...ADMIN_KEYS,
    ...SHORTCUT_HELP.map((r) => `Player, press **${r.keys.join('** or **')}**: ${sentence(r.action)}`),
  ]);
}

export const GENERATED = {
  R02: renderRoles,
  R05: renderKeys,
  R06: renderStatuses,
} as const;
