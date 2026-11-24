import type { MessageText } from '@ad/shared/messages';
import type { TranslationStore } from './store';

type Approved = ReadonlyMap<string, { status: 'approved'; text: MessageText }>;

/**
 * Approved rows per locale, loaded once per version. `bump()` is called on every approve and publish, so a
 * change shows on the next request. Drafts and rows in review are never loaded.
 */
export class CatalogCache {
  private version = 0;
  private loaded = new Map<string, { version: number; data: Approved }>();
  constructor(private readonly store: TranslationStore) {}

  bump(): void {
    this.version++;
  }

  async approved(locale: string): Promise<Approved> {
    const hit = this.loaded.get(locale);
    if (hit && hit.version === this.version) return hit.data;
    const version = this.version;
    const rows = await this.store.listApproved(locale);
    const data: Approved = new Map(
      rows.filter((r) => r.status === 'approved').map((r) => [r.key, { status: 'approved' as const, text: r.text }]),
    );
    this.loaded.set(locale, { version, data });
    return data;
  }
}
