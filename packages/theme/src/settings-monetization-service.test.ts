import { describe, expect, it, vi } from 'vitest';
import { ValidationFailed } from '@ad/shared';
import { SettingsService } from './settings-service';
import { MemorySettingsStore } from './testing';

const admin = { accountId: '0198c000-0000-7000-8000-000000000001', role: 'admin' as const };
const superAdmin = { accountId: '0198c000-0000-7000-8000-000000000003', role: 'super_admin' as const };
const logger = () => ({ error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn(), child: vi.fn() });

function setup(paystackKeyPresent: boolean) {
  const store = new MemorySettingsStore();
  const service = new SettingsService({
    store,
    logger: logger(),
    monetizationContext: () => ({ paystackKeyPresent }),
  });
  return { store, service };
}

describe('monetization settings through the service', () => {
  it('refuses donations on when the Paystack key is missing', async () => {
    const { service } = setup(false);
    const error = await service.update(admin, { 'donate.enabled': true }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ValidationFailed);
    expect(JSON.stringify((error as ValidationFailed).fields)).toContain('PAYSTACK_SECRET_KEY');
    expect(await service.get('donate.enabled')).toBe(false);
  });

  it('allows donations on when the key is set', async () => {
    const { service } = setup(true);
    await service.update(admin, { 'donate.enabled': true });
    expect(await service.get('donate.enabled')).toBe(true);
  });

  it('checks a preset against the stored minimum', async () => {
    const { service } = setup(true);
    await expect(service.update(admin, { 'donate.presets_minor.ngn': [100, 50000] })).rejects.toBeInstanceOf(
      ValidationFailed,
    );
  });

  it('turning sponsors on is a plain admin change and is audited', async () => {
    const { service, store } = setup(false);
    await service.update(admin, { 'sponsors.enabled': true });
    expect(await service.get('sponsors.enabled')).toBe(true);
    expect(store.audit.entries.length).toBeGreaterThan(0);
  });

  it('only a super admin can change the largest gift', async () => {
    const { service } = setup(true);
    await expect(service.update(admin, { 'donate.max_minor.ngn': 100_000_000 })).rejects.toThrow();
    await service.update(superAdmin, { 'donate.max_minor.ngn': 100_000_000 });
    expect(await service.get('donate.max_minor.ngn')).toBe(100_000_000);
  });
});
