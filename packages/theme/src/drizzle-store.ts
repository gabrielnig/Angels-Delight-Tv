import { assets, auditLog, themeSettings, type Database } from '@ad/db';
import { uuidv7 } from '@ad/shared';
import { and, count, desc, eq, isNotNull, isNull, lt, max, sql, type SQL } from 'drizzle-orm';
import type { AssetStore } from './logo';
import type { ListFilter, NewThemeRow, ThemeRow, ThemeStore, ThemeTx } from './store';

type Executor = Pick<Database, 'select' | 'insert' | 'update' | 'execute'>;

function mapRow(row: typeof themeSettings.$inferSelect): ThemeRow {
  return { ...row };
}

function kindClause(kind?: 'published' | 'draft'): SQL | undefined {
  if (kind === 'published') return isNotNull(themeSettings.publishedAt);
  if (kind === 'draft') return isNull(themeSettings.publishedAt);
  return undefined;
}

function bind(db: Executor): ThemeTx {
  return {
    async findByStatus(status) {
      const [row] = await db
        .select()
        .from(themeSettings)
        .where(eq(themeSettings.status, status))
        .limit(1);
      return row ? mapRow(row) : null;
    },
    async findById(id) {
      if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
      const [row] = await db.select().from(themeSettings).where(eq(themeSettings.id, id)).limit(1);
      return row ? mapRow(row) : null;
    },
    async list(filter: ListFilter) {
      const rows = await db
        .select()
        .from(themeSettings)
        .where(
          and(
            kindClause(filter.kind),
            filter.beforeVersion === undefined
              ? undefined
              : lt(themeSettings.version, filter.beforeVersion),
          ),
        )
        .orderBy(desc(themeSettings.version))
        .limit(filter.limit);
      return rows.map(mapRow);
    },
    async count(kind) {
      const [row] = await db.select({ value: count() }).from(themeSettings).where(kindClause(kind));
      return row?.value ?? 0;
    },
    async nextVersion() {
      const [row] = await db.select({ value: max(themeSettings.version) }).from(themeSettings);
      return (row?.value ?? 0) + 1;
    },
    async insert(input: NewThemeRow) {
      const [row] = await db
        .insert(themeSettings)
        .values({
          id: input.id ?? uuidv7(),
          status: input.status,
          version: input.version,
          tokens: input.tokens as Record<string, unknown>,
          logoAssetId: input.logoAssetId,
          faviconAssetId: input.faviconAssetId,
          createdBy: input.createdBy,
          publishedAt: input.publishedAt,
          ...(input.createdAt ? { createdAt: input.createdAt } : {}),
        })
        .returning();
      return mapRow(row!);
    },
    async update(id, patch) {
      const { tokens, ...rest } = patch;
      const [row] = await db
        .update(themeSettings)
        .set({
          ...rest,
          ...(tokens === undefined ? {} : { tokens: tokens as Record<string, unknown> }),
        })
        .where(eq(themeSettings.id, id))
        .returning();
      if (!row) throw new Error('theme row not found');
      return mapRow(row);
    },
    async audit(entry) {
      await db.insert(auditLog).values({
        action: entry.action,
        actorAccountId: entry.actorAccountId,
        actorRole: entry.actorRole,
        targetType: entry.targetType,
        targetId: entry.targetId,
        outcome: entry.outcome,
        metadata: entry.metadata,
      });
    },
  };
}

/**
 * Postgres backed store. Writers take a transaction scoped advisory lock, so two admins saving at once
 * cannot both claim the same version number or leave two drafts behind.
 */
export function createDrizzleThemeStore(db: Database): ThemeStore {
  return {
    async transaction(fn) {
      return db.transaction(async (tx) => {
        await tx.execute(sql`select pg_advisory_xact_lock(hashtext('theme_settings'))`);
        return fn(bind(tx));
      });
    },
    async published() {
      const row = await bind(db).findByStatus('published');
      return row;
    },
  };
}

export function createDrizzleAssetStore(db: Database): AssetStore {
  return {
    async insert(asset) {
      await db.insert(assets).values({
        id: asset.id,
        purpose: asset.purpose,
        status: asset.status,
        mediaKeyBase: asset.mediaKeyBase,
        variants: asset.variants,
        mime: asset.mime,
        bytes: asset.bytes,
        width: asset.width,
        height: asset.height,
        sha256: asset.sha256,
        placeholderColor: asset.placeholderColor,
        altText: asset.altText,
        createdBy: asset.createdBy,
      });
    },
  };
}
