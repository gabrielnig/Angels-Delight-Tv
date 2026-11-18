import type { Database } from '@ad/db';
import { sql } from 'drizzle-orm';

export type NoticeKind = 'encode_done' | 'encode_failed' | 'captions_ready' | 'captions_failed';

export interface StaffNotice {
  kind: NoticeKind;
  title: string;
  body?: string;
  href?: string | null;
  videoId?: string | null;
}

/** Notices older than this are dropped whenever a new one is written, so the table cannot grow without bound. */
export const NOTICE_KEEP_DAYS = 90;

/**
 * Puts a notice in the bell of every active editor and admin (M21-S03). It never throws: a notice must not
 * fail the job that produced it, so a failure is handed to `onError` and the job carries on.
 */
export async function notifyStaff(
  db: Database,
  notice: StaffNotice,
  onError: (error: unknown) => void = () => undefined,
): Promise<number> {
  try {
    const rows = await db.execute(sql`
      INSERT INTO admin_notices (recipient_id, kind, title, body, href, video_id)
      SELECT a.id, ${notice.kind}, ${notice.title}, ${notice.body ?? ''}, ${notice.href ?? null}, ${notice.videoId ?? null}
      FROM accounts a
      WHERE a.role IN ('editor', 'admin') AND a.status = 'active'
      RETURNING id`);
    await db.execute(
      sql`DELETE FROM admin_notices WHERE created_at < now() - make_interval(days => ${NOTICE_KEEP_DAYS})`,
    );
    const list = Array.isArray(rows) ? rows : ((rows as { rows?: unknown[] }).rows ?? []);
    return list.length;
  } catch (error) {
    onError(error);
    return 0;
  }
}
