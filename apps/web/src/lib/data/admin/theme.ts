import 'server-only';
import { AppError, Forbidden, ValidationFailed, type Actor } from '@ad/shared';
import { FONT_OPTIONS } from '@ad/theme/client';
import { WarningsNeedConfirmation, type HistoryItem } from '@ad/theme';
import { can } from '@/lib/admin/can';
import { themeRuntime } from './theme-runtime';
import type {
  ActionResult,
  HistoryDto,
  HistoryRowDto,
  LogoDto,
  ThemeEditorDto,
  VersionDetailDto,
} from './theme-types';
import type { AdminActor } from './types';

/**
 * Typed data access for S56 and S57. Every call re-checks the permission (the page is never the only
 * check) and returns a serialisable result: failures become messages, never stack traces.
 */

const toActor = (actor: AdminActor): Actor => ({ accountId: actor.accountId, role: actor.role });

function guard(actor: AdminActor): void {
  if (!can(actor.role, 'settings.theme'))
    throw new Forbidden('You do not have access to the theme');
}

export async function toResult<T>(fn: () => Promise<T>): Promise<ActionResult<T>> {
  try {
    return { ok: true, data: await fn() };
  } catch (error) {
    if (error instanceof WarningsNeedConfirmation) {
      return { ok: false, message: error.message, warnings: error.warnings };
    }
    if (error instanceof ValidationFailed) {
      return { ok: false, message: error.message, fields: error.fields };
    }
    if (error instanceof AppError) return { ok: false, message: error.message };
    const { logger } = await themeRuntime();
    logger.error('theme action failed', { error });
    return {
      ok: false,
      message: 'Something went wrong on our side. Your draft is safe. Try again.',
    };
  }
}

async function logoDto(assetId: string | null): Promise<LogoDto | null> {
  if (!assetId) return null;
  const { logos, storage, logger } = await themeRuntime();
  try {
    const asset = await logos.get(assetId);
    if (!asset) return null;
    const stream = await storage.get(asset.variants[0]!.key);
    const chunks: Buffer[] = [];
    for await (const chunk of stream) chunks.push(Buffer.from(chunk as Uint8Array));
    return {
      assetId: asset.id,
      dataUrl: `data:image/webp;base64,${Buffer.concat(chunks).toString('base64')}`,
      altText: asset.altText,
      width: asset.width,
      height: asset.height,
      bytes: asset.bytes,
    };
  } catch (error) {
    logger.error('logo preview failed', { assetId, error });
    return null;
  }
}

async function editorDto(actor: AdminActor): Promise<ThemeEditorDto> {
  const { theme, settings } = await themeRuntime();
  const [state, platformName] = await Promise.all([
    theme.getEditorState(toActor(actor)),
    settings.get('platform.name'),
  ]);
  return {
    theme: state.working,
    logo: await logoDto(state.logoAssetId),
    platformName,
    hasDraft: state.hasDraft,
    draftVersion: state.draftVersion,
    draftSavedAt: state.draftSavedAt?.toISOString() ?? null,
    publishedVersion: state.publishedVersion,
    publishedAt: state.publishedAt?.toISOString() ?? null,
  };
}

export interface SaveInput {
  theme: unknown;
  /** `undefined` keeps the current logo, `null` removes it. */
  logoAssetId?: string | null;
  platformName?: string;
}

async function saveParts(actor: AdminActor, input: SaveInput) {
  const { theme, settings } = await themeRuntime();
  if (input.platformName !== undefined) {
    await settings.update(toActor(actor), { 'platform.name': input.platformName });
  }
  return theme.saveDraft(
    toActor(actor),
    input.theme,
    input.logoAssetId === undefined ? {} : { logoAssetId: input.logoAssetId },
  );
}

export const themeAdmin = {
  load: (actor: AdminActor) => toResult(async () => (guard(actor), editorDto(actor))),

  saveDraft: (actor: AdminActor, input: SaveInput) =>
    toResult(async () => {
      guard(actor);
      await saveParts(actor, input);
      return editorDto(actor);
    }),

  publish: (actor: AdminActor, input: SaveInput & { acknowledgeWarnings?: boolean }) =>
    toResult(async () => {
      guard(actor);
      const { theme } = await themeRuntime();
      await saveParts(actor, input);
      await theme.publish(toActor(actor), { acknowledgeWarnings: input.acknowledgeWarnings });
      return editorDto(actor);
    }),

  reset: (actor: AdminActor) =>
    toResult(async () => {
      guard(actor);
      const { theme } = await themeRuntime();
      await theme.resetToDefault(toActor(actor));
      return editorDto(actor);
    }),

  uploadLogo: (actor: AdminActor, bytes: Uint8Array, altText: string | null) =>
    toResult(async () => {
      guard(actor);
      const { logos } = await themeRuntime();
      const asset = await logos.upload(toActor(actor), bytes, { purpose: 'logo', altText });
      const dto = await logoDto(asset.id);
      if (!dto) throw new Error('logo missing after upload');
      return dto;
    }),

  history: (
    actor: AdminActor,
    options: { filter?: 'all' | 'published' | 'draft'; beforeVersion?: number },
  ) =>
    toResult(async (): Promise<HistoryDto> => {
      guard(actor);
      const { theme } = await themeRuntime();
      const page = await theme.listHistory(toActor(actor), { ...options, limit: 20 });
      return {
        items: page.items.map((item) => historyRow(actor, item)),
        total: page.total,
        nextBefore: page.nextBefore,
      };
    }),

  version: (actor: AdminActor, id: string) =>
    toResult(async (): Promise<VersionDetailDto> => {
      guard(actor);
      const { theme } = await themeRuntime();
      const snapshot = await theme.getVersion(toActor(actor), id);
      const check = snapshot.gate.checks.find((item) => item.id === 'on-primary')!;
      return {
        id: snapshot.id,
        version: snapshot.version,
        status: snapshot.publishedAt ? 'published' : 'draft',
        isCurrent: snapshot.status === 'published',
        isDraftInProgress: snapshot.status === 'draft',
        at: (snapshot.publishedAt ?? snapshot.createdAt).toISOString(),
        by: nameFor(actor, snapshot.createdBy),
        fontLabel:
          FONT_OPTIONS.find((font) => font.key === snapshot.theme.fontKey)?.label ?? 'Inter',
        typeScale: snapshot.theme.typeScale,
        swatches: Object.values(snapshot.theme.colors),
        primary: snapshot.theme.colors.primary,
        contrast: check.ratio,
        contrastLevel: check.level,
        theme: snapshot.theme,
      };
    }),

  restore: (actor: AdminActor, id: string) =>
    toResult(async () => {
      guard(actor);
      const { theme } = await themeRuntime();
      const restored = await theme.restoreVersion(toActor(actor), id);
      return { version: restored.version };
    }),
};

/** Seam for the users lane: replace with a lookup of display names by account id. */
function nameFor(actor: AdminActor, accountId: string | null): string {
  if (!accountId) return 'Unknown';
  return accountId === actor.accountId ? actor.name : 'Another admin';
}

function historyRow(actor: AdminActor, item: HistoryItem): HistoryRowDto {
  return {
    id: item.id,
    version: item.version,
    status: item.status,
    isCurrent: item.isCurrent,
    isDraftInProgress: item.isDraftInProgress,
    at: item.at.toISOString(),
    by: nameFor(actor, item.by),
    fontLabel: FONT_OPTIONS.find((font) => font.key === item.fontKey)?.label ?? 'Inter',
    typeScale: item.typeScale,
    swatches: item.swatches,
    primary: item.primary,
    contrast: item.contrast,
    contrastLevel: item.contrastLevel,
  };
}
