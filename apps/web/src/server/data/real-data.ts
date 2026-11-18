import 'server-only';
import { hmacSha256 } from '@ad/shared';
import { viewerRuntime } from '../viewer/runtime';
import { authRuntime } from '../auth/runtime';
import { ExportJobs } from './export-jobs';
import { cookieProfileIo } from './profile-io';
import { AccountViewerData } from './real-account-data';
import { RealCatalog } from './real-catalog';
import { RealLibrary } from './real-library';
import { RealProfiles } from './real-profiles';
import { RealSite } from './real-site';
import { themeRuntime } from '../../lib/data/admin/theme-runtime';

export const createRealCatalog = () => new RealCatalog(viewerRuntime().ctx);
export const createRealLibrary = () => new RealLibrary(viewerRuntime().ctx);
export const createRealProfiles = () => new RealProfiles(viewerRuntime().ctx, cookieProfileIo());

/** Site content from settings, the one place pages read the name, sign up mode and maintenance state. */
export const createRealSite = () =>
  new RealSite({
    getAll: async () => (await themeRuntime()).settings.getAll(),
    getPublishedPage: async (slug) => (await themeRuntime()).settings.getPublishedPage(slug),
  });

const LABEL = new TextEncoder().encode('ad:account-export-key:v1');
let viewerData: AccountViewerData | undefined;

/** Stats, playback settings and the data export for the account area. One per process. */
export function accountViewerData(): AccountViewerData {
  viewerData ??= new AccountViewerData(viewerRuntime().ctx, {
    exportSecret: hmacSha256(viewerRuntime().profileSecret, LABEL),
  });
  return viewerData;
}

let jobs: ExportJobs | undefined;

/** The export job runner. One per process. The mailer and account lookups come from the auth runtime. */
export function exportJobs(): ExportJobs {
  if (!jobs) {
    const auth = authRuntime();
    jobs = new ExportJobs(viewerRuntime().ctx, {
      data: accountViewerData(),
      accountInfo: async (accountId) => {
        const info = await auth.staff.getOverview({ accountId, role: 'viewer', sessionId: '' });
        return { email: info.email, memberSince: info.memberSince.toISOString() };
      },
      mailer: auth.mailer,
    });
  }
  return jobs;
}

/** The account area's viewer source: stats and playback plus the export job. */
export function accountViewerSource() {
  const data = accountViewerData();
  const runner = exportJobs();
  return Object.assign(Object.create(data) as AccountViewerData, {
    exports: {
      request: (accountId: string, password: string) => runner.request(accountId, password),
      state: (accountId: string) => runner.state(accountId),
      kick: () => void runner.runPending().catch(() => undefined),
    },
  });
}
