import { Forbidden, ValidationFailed, roleAtLeast, type Actor } from '@ad/shared';
import {
  localeInfo,
  validateTranslation,
  type CatalogShape,
  type MessageText,
} from '@ad/shared/messages';
import { exportCsv, exportJson } from './export';
import { planImport, type ImportPlan } from './import';
import { hashText, summarize, type Summary } from './status';
import type { TranslationStore, UpsertInput } from './store';

export interface AuditEvent {
  action: string;
  outcome: 'success';
  actorAccountId: string;
  actorRole: string;
  targetType: string;
  targetId: string;
  summary: string;
  extra?: Record<string, unknown>;
}

export interface TranslationSettings {
  uiLanguages(): Promise<string[]>;
  setUiLanguages(next: string[]): Promise<void>;
  minPercent(): Promise<number>;
}

export interface ServiceDeps {
  store: TranslationStore;
  english: CatalogShape;
  baseline: (locale: string) => CatalogShape;
  /** Sample drafts pending native review. Loaded on request as draft rows, never as approved text. */
  drafts?: (locale: string) => CatalogShape;
  audit: (event: AuditEvent) => Promise<void>;
  settings: TranslationSettings;
  /** Called after every write so the catalog cache version moves. */
  onChange?: () => void;
}

const NO_PERMISSION = 'You do not have permission to do this';

export class TranslationService {
  constructor(private readonly deps: ServiceDeps) {}

  private need(actor: Actor, role: 'editor' | 'admin' | 'super_admin') {
    if (!roleAtLeast(actor.role, role)) throw new Forbidden(NO_PERMISSION);
  }

  private translatable(locale: string) {
    const info = localeInfo(locale);
    if (!info || info.source) throw new ValidationFailed({ locale: ['Pick a language to translate into'] }, 'Unsupported locale');
  }

  private englishFor(key: string): MessageText {
    const text = this.deps.english[key];
    if (text === undefined) throw new ValidationFailed({ key: ['Unknown key'] }, 'Unknown key');
    return text;
  }

  private async record(actor: Actor, action: string, locale: string, key: string, summary: string, extra?: Record<string, unknown>) {
    await this.deps.audit({
      action,
      outcome: 'success',
      actorAccountId: actor.accountId,
      actorRole: actor.role,
      targetType: 'ui_translation',
      targetId: `${locale}:${key}`,
      summary,
      ...(extra ? { extra } : {}),
    });
    this.deps.onChange?.();
  }

  async summary(locale: string): Promise<Summary> {
    return summarize({
      locale,
      english: this.deps.english,
      baseline: this.deps.baseline(locale),
      rows: await this.deps.store.list(locale),
    });
  }

  async exportCsv(actor: Actor, locale: string): Promise<string> {
    this.need(actor, 'editor');
    this.translatable(locale);
    return exportCsv({ locale, english: this.deps.english, baseline: this.deps.baseline(locale), rows: await this.deps.store.list(locale) });
  }

  async exportJson(actor: Actor, locale: string): Promise<string> {
    this.need(actor, 'editor');
    this.translatable(locale);
    return exportJson({ locale, english: this.deps.english, baseline: this.deps.baseline(locale), rows: await this.deps.store.list(locale) });
  }

  /** Imported rows land in review. With `dryRun` nothing is written or audited. */
  async importCsv(actor: Actor, locale: string, csv: string, options: { dryRun?: boolean } = {}): Promise<ImportPlan> {
    this.need(actor, 'editor');
    this.translatable(locale);
    const plan = planImport({
      locale,
      english: this.deps.english,
      baseline: this.deps.baseline(locale),
      existing: await this.deps.store.list(locale),
      csv,
    });
    if (options.dryRun || plan.writes.length === 0) return plan;
    await this.deps.store.upsertMany(
      locale,
      plan.writes.map((w) => ({ ...w, updatedBy: actor.accountId })),
    );
    await this.record(actor, 'i18n.translation.import', locale, `import:${plan.writes.length}`, `Imported ${plan.writes.length} ${locale} texts for review`, {
      added: plan.added.length,
      changed: plan.changed.length,
      rejected: plan.rejected.length,
    });
    return plan;
  }

  /**
   * Puts the sample draft text for a language into the workspace as draft rows, for a native reviewer to fix and an
   * Admin to approve. Existing rows are never touched and nothing is approved.
   */
  async loadDrafts(actor: Actor, locale: string): Promise<{ added: number; skipped: number }> {
    this.need(actor, 'editor');
    this.translatable(locale);
    const entries = this.deps.drafts?.(locale) ?? {};
    const existing = new Set((await this.deps.store.list(locale)).map((r) => r.key));
    const writes: UpsertInput[] = [];
    let skipped = 0;
    for (const [key, text] of Object.entries(entries)) {
      const english = this.deps.english[key];
      if (english === undefined || existing.has(key)) {
        skipped++;
        continue;
      }
      const result = validateTranslation({ key, locale, english, text });
      if (result.errors.length > 0) {
        skipped++;
        continue;
      }
      writes.push({
        key,
        text: result.normalized,
        status: 'draft',
        sourceHash: hashText(english),
        updatedBy: actor.accountId,
        note: 'Sample draft, pending native review',
      });
    }
    if (writes.length === 0) return { added: 0, skipped };
    await this.deps.store.upsertMany(locale, writes);
    await this.record(actor, 'i18n.translation.import', locale, `drafts:${writes.length}`, `Loaded ${writes.length} sample ${locale} drafts for review`, { skipped });
    return { added: writes.length, skipped };
  }

  async save(actor: Actor, locale: string, key: string, text: MessageText, note?: string) {
    this.need(actor, 'editor');
    this.translatable(locale);
    const english = this.englishFor(key);
    const result = validateTranslation({ key, locale, english, text });
    if (result.errors.length > 0) throw new ValidationFailed({ text: result.errors }, result.errors.join('; '));
    await this.deps.store.upsert(locale, {
      key,
      text: result.normalized,
      status: 'draft',
      sourceHash: hashText(english),
      updatedBy: actor.accountId,
      note: note ?? null,
    });
    await this.record(actor, 'i18n.translation.save', locale, key, `Saved ${locale} text for ${key}`);
    return { warnings: result.warnings };
  }

  private async check(locale: string, key: string): Promise<string[]> {
    const row = (await this.deps.store.list(locale)).find((r) => r.key === key);
    if (!row) return ['No translation to approve'];
    return validateTranslation({ locale, english: this.englishFor(key), text: row.text }).errors;
  }

  async approve(actor: Actor, locale: string, key: string) {
    this.need(actor, 'admin');
    this.translatable(locale);
    const errors = await this.check(locale, key);
    if (errors.length > 0) throw new ValidationFailed({ text: errors }, errors.join('; '));
    await this.deps.store.setStatus(locale, key, 'approved', actor.accountId);
    await this.record(actor, 'i18n.translation.approve', locale, key, `Approved ${locale} text for ${key}`);
  }

  async approveMany(actor: Actor, locale: string, keys: readonly string[]) {
    this.need(actor, 'admin');
    this.translatable(locale);
    const skipped: { key: string; reason: string }[] = [];
    let approved = 0;
    for (const key of keys) {
      const errors = await this.check(locale, key);
      if (errors.length > 0) {
        skipped.push({ key, reason: errors.join('; ') });
        continue;
      }
      await this.deps.store.setStatus(locale, key, 'approved', actor.accountId);
      approved++;
    }
    if (approved > 0) {
      await this.record(actor, 'i18n.translation.approve', locale, `bulk:${approved}`, `Approved ${approved} ${locale} texts`, { count: approved, skipped: skipped.length });
    }
    return { approved, skipped };
  }

  async publish(actor: Actor, locale: string, options: { override?: { reason: string } } = {}) {
    this.need(actor, 'admin');
    this.translatable(locale);
    const [summary, min, current] = await Promise.all([
      this.summary(locale),
      this.deps.settings.minPercent(),
      this.deps.settings.uiLanguages(),
    ]);
    let overridden = false;
    if (summary.approvedPercent < min) {
      if (!options.override) {
        throw new ValidationFailed(
          { locale: [`Only ${summary.approvedPercent} percent is approved. The threshold is ${min} percent`] },
          `Below the publish threshold of ${min} percent`,
        );
      }
      this.need(actor, 'super_admin');
      const reason = options.override.reason.trim();
      if (reason.length < 3) throw new ValidationFailed({ reason: ['Give a reason'] }, 'An override needs a reason');
      overridden = true;
      await this.record(actor, 'i18n.translation.override_threshold', locale, '*', `Published ${locale} below ${min} percent`, { reason, percent: summary.approvedPercent });
    }
    if (!current.includes(locale)) await this.deps.settings.setUiLanguages([...current, locale]);
    await this.record(actor, 'i18n.translation.publish_locale', locale, '*', `Published ${locale}`, { percent: summary.approvedPercent, overridden });
  }

  async unpublish(actor: Actor, locale: string) {
    this.need(actor, 'admin');
    this.translatable(locale);
    const current = await this.deps.settings.uiLanguages();
    const next = current.filter((l) => l !== locale);
    await this.deps.settings.setUiLanguages(next.length > 0 ? next : ['en']);
    await this.record(actor, 'i18n.translation.publish_locale', locale, '*', `Unpublished ${locale}`, { unpublished: true });
  }
}
