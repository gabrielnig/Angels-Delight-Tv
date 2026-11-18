import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@ad/audit', () => ({ writeAudit: vi.fn(async () => undefined) }));

import { writeAudit as inner } from '@ad/audit';
import { writeAudit } from './audit';
import { catalogCache } from './cache';

describe('catalog audit writes empty the cache', () => {
  beforeEach(() => catalogCache.invalidate());
  it('drops cached reads after an audited admin change', async () => {
    let value = 'before';
    expect(await catalogCache.remember('k', async () => value)).toBe('before');
    value = 'after';
    await writeAudit({} as never, { action: 'video.update' } as never);
    expect(inner).toHaveBeenCalled();
    expect(await catalogCache.remember('k', async () => value)).toBe('after');
  });
});
