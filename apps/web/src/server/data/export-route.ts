import { EXPORT_FILE_NAME } from '../auth/account-repo';
import type { AccountViewerData, ExportFile } from './real-account-data';

interface Deps {
  /** The signed in, verified account id, or null. */
  sessionAccountId(request: Request): Promise<string | null>;
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
 * GET /api/account/export?token=... Needs the session and a token the same account was given ten minutes ago by
 * the export request. A wrong account, a bad token and an expired one all answer 404, so the route tells nothing.
 */
export function createExportHandler(deps: Deps) {
  return async (request: Request): Promise<Response> => {
    const accountId = await deps.sessionAccountId(request);
    if (!accountId) return jsonError(401, 'unauthorized');
    const token = new URL(request.url).searchParams.get('token');
    if (!token || deps.data.verifyExportToken(token) !== accountId)
      return jsonError(404, 'not_found');
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
