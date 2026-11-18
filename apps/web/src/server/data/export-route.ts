import { EXPORT_FILE_NAME } from './export-jobs';
import type { AccountViewerData, ExportFile } from './real-account-data';

interface Deps {
  /** The signed in, verified account id, or null. */
  sessionAccountId(request: Request): Promise<string | null>;
  /** True while the account has a finished export that has not expired. */
  hasActiveExport(accountId: string): Promise<boolean>;
  accountInfo(accountId: string): Promise<{ email: string; memberSince: string }>;
  data: Pick<AccountViewerData, 'verifyExportToken'> & {
    buildExport(
      accountId: string,
      account: { email: string; memberSince: string },
    ): Promise<ExportFile>;
  };
}

const noStore = { 'Cache-Control': 'private, no-store' } as const;
const jsonError = (status: number, code: string) =>
  Response.json({ error: { code } }, { status, headers: noStore });

/**
 * GET /api/account/export?token=... Needs the session, a finished unexpired export and the token the export job
 * mailed (valid 24 hours). A wrong account, a bad token and an expired one all answer 404, so the route tells nothing.
 */
export function createExportHandler(deps: Deps) {
  return async (request: Request): Promise<Response> => {
    const accountId = await deps.sessionAccountId(request);
    const url = new URL(request.url);
    if (!accountId) {
      // The mailed link is opened in a browser: sign in, then come back to it.
      const back = encodeURIComponent(`${url.pathname}${url.search}`);
      return new Response(null, {
        status: 302,
        headers: { ...noStore, Location: `/sign-in?next=${back}` },
      });
    }
    const token = url.searchParams.get('token');
    if (!token || deps.data.verifyExportToken(token) !== accountId)
      return jsonError(404, 'not_found');
    if (!(await deps.hasActiveExport(accountId))) return jsonError(404, 'not_found');
    const file = await deps.data.buildExport(accountId, await deps.accountInfo(accountId));
    return new Response(JSON.stringify(file, null, 2), {
      status: 200,
      headers: {
        ...noStore,
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Disposition': `attachment; filename="${EXPORT_FILE_NAME}"`,
        'X-Content-Type-Options': 'nosniff',
      },
    });
  };
}
