import { schema, withAccount } from '@ad/db';
import type { ViewerContext } from '@ad/viewer';
import { and, asc, desc, eq, gt } from 'drizzle-orm';
import type { ExportState } from '../../lib/data/types';
import { viewerActor } from './actor';
import type { ExportFile } from './real-account-data';

const HOUR = 3600_000;
export const EXPORT_FILE_NAME = 'angels-delight-data.json';

export interface ExportJobDeps {
  data: {
    buildExport(
      accountId: string,
      account: { email: string; memberSince: string },
    ): Promise<ExportFile>;
    signExportToken(accountId: string, expiresAt?: Date): string;
  };
  accountInfo(accountId: string): Promise<{ email: string; memberSince: string }>;
  mailer: {
    sendExportReady(input: { to: string; token: string; hours: number }): Promise<unknown>;
    sendExportFailed(input: { to: string }): Promise<unknown>;
  };
  now?: () => Date;
  /** How long a finished export link works. M02-S05 says 24 hours. */
  ttlHours?: number;
  /** Builds attempted before the request is marked failed and the person is told. */
  maxAttempts?: number;
}

export type ExportRequestResult = { status: 'started' | 'already' } | { status: 'wrong_password' };

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "17 Nov, 9:14 am" in Lagos time (UTC+1, no daylight saving). */
function lagosLabel(date: Date): string {
  const t = new Date(date.getTime() + HOUR);
  const h = t.getUTCHours();
  const minutes = String(t.getUTCMinutes()).padStart(2, '0');
  return `${t.getUTCDate()} ${MONTHS[t.getUTCMonth()]}, ${h % 12 === 0 ? 12 : h % 12}:${minutes} ${h < 12 ? 'am' : 'pm'}`;
}

function sizeLabel(bytes: number): string {
  return bytes < 1024 ? `${bytes} bytes` : `${(bytes / 1024).toFixed(1)} KB`;
}

/**
 * Data export as a background job (M02-S05, D-096). A request needs the account password and is allowed once
 * per 24 hours unless the last one failed. The job builds the file to check and size it, then mails a link that
 * works for 24 hours. The file itself is rebuilt from live data on download, so no personal data is stored.
 */
export class ExportJobs {
  private readonly now: () => Date;
  private readonly ttl: number;
  private readonly maxAttempts: number;

  constructor(
    private readonly service: ViewerContext,
    private readonly deps: ExportJobDeps,
  ) {
    this.now = deps.now ?? (() => new Date());
    this.ttl = (deps.ttlHours ?? 24) * HOUR;
    this.maxAttempts = deps.maxAttempts ?? 3;
  }

  async request(accountId: string, password: string): Promise<ExportRequestResult> {
    if (!(await this.service.verifyPassword(accountId, password)))
      return { status: 'wrong_password' };
    const now = this.now();
    const since = new Date(now.getTime() - this.ttl);
    return withAccount(this.service.db, viewerActor(accountId), async (tx) => {
      const [recent] = await tx
        .select({ id: schema.dataExports.id })
        .from(schema.dataExports)
        .where(
          and(
            eq(schema.dataExports.accountId, accountId),
            gt(schema.dataExports.requestedAt, since),
            eq(schema.dataExports.status, 'ready'),
          ),
        )
        .limit(1);
      const [pending] = await tx
        .select({ id: schema.dataExports.id })
        .from(schema.dataExports)
        .where(
          and(
            eq(schema.dataExports.accountId, accountId),
            eq(schema.dataExports.status, 'pending'),
          ),
        )
        .limit(1);
      if (recent || pending) return { status: 'already' as const };
      await tx.insert(schema.dataExports).values({ accountId, requestedAt: now });
      return { status: 'started' as const };
    });
  }

  async state(accountId: string): Promise<ExportState> {
    const now = this.now();
    const [row] = await withAccount(this.service.db, viewerActor(accountId), (tx) =>
      tx
        .select()
        .from(schema.dataExports)
        .where(eq(schema.dataExports.accountId, accountId))
        .orderBy(desc(schema.dataExports.requestedAt))
        .limit(1),
    );
    if (!row) return { status: 'none' };
    const requestedAt = lagosLabel(row.requestedAt);
    if (row.status === 'pending') return { status: 'pending', requestedAt };
    if (row.status === 'failed') return { status: 'failed', requestedAt };
    if (!row.expiresAt || row.expiresAt <= now) return { status: 'none' };
    return {
      status: 'ready',
      requestedAt,
      fileName: EXPORT_FILE_NAME,
      sizeLabel: sizeLabel(row.sizeBytes ?? 0),
      expiresLabel: lagosLabel(row.expiresAt),
      downloadHref: `/api/account/export?token=${this.deps.data.signExportToken(accountId, row.expiresAt)}`,
    };
  }

  /** Whether the account has a finished export that has not expired. The download route asks this. */
  async hasActive(accountId: string): Promise<boolean> {
    return (await this.state(accountId)).status === 'ready';
  }

  /** The job tick: builds every pending export. Returns how many it handled. Safe to run in many instances. */
  async runPending(): Promise<number> {
    const pending = await this.service.db
      .select({ id: schema.dataExports.id, accountId: schema.dataExports.accountId })
      .from(schema.dataExports)
      .where(eq(schema.dataExports.status, 'pending'))
      .orderBy(asc(schema.dataExports.requestedAt))
      .limit(20);
    let handled = 0;
    for (const job of pending) {
      await this.runOne(job.id, job.accountId);
      handled++;
    }
    return handled;
  }

  private async runOne(id: string, accountId: string): Promise<void> {
    const actor = viewerActor(accountId);
    const claimed = await withAccount(this.service.db, actor, async (tx) => {
      const [row] = await tx
        .select({ attempts: schema.dataExports.attempts, status: schema.dataExports.status })
        .from(schema.dataExports)
        .where(eq(schema.dataExports.id, id))
        .for('update', { skipLocked: true });
      if (!row || row.status !== 'pending') return null;
      await tx
        .update(schema.dataExports)
        .set({ attempts: row.attempts + 1 })
        .where(eq(schema.dataExports.id, id));
      return row.attempts + 1;
    });
    if (claimed === null) return;
    try {
      const info = await this.deps.accountInfo(accountId);
      const file = await this.deps.data.buildExport(accountId, info);
      const bytes = Buffer.byteLength(JSON.stringify(file, null, 2));
      const readyAt = this.now();
      const expiresAt = new Date(readyAt.getTime() + this.ttl);
      await withAccount(this.service.db, actor, (tx) =>
        tx
          .update(schema.dataExports)
          .set({ status: 'ready', sizeBytes: bytes, readyAt, expiresAt })
          .where(eq(schema.dataExports.id, id)),
      );
      await this.deps.mailer.sendExportReady({
        to: info.email,
        token: this.deps.data.signExportToken(accountId, expiresAt),
        hours: this.ttl / HOUR,
      });
    } catch {
      if (claimed < this.maxAttempts) return;
      await withAccount(this.service.db, actor, (tx) =>
        tx
          .update(schema.dataExports)
          .set({ status: 'failed', failedAt: this.now() })
          .where(eq(schema.dataExports.id, id)),
      );
      try {
        const info = await this.deps.accountInfo(accountId);
        await this.deps.mailer.sendExportFailed({ to: info.email });
      } catch {
        // The failure state is on screen and in the table. A lost mail is not worth another failure.
      }
    }
  }
}
