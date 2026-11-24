// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react';
import { EN_NG, pseudo, type CatalogShape } from '@ad/shared/messages';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AccountNav } from '../../components/account/AccountNav';
import { I18nProvider } from './provider';

vi.mock('next/navigation', () => ({
  usePathname: () => '/account',
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));
vi.mock('../../app/actions', () => ({ signOutAction: vi.fn() }));
afterEach(cleanup);

const PSEUDO = Object.fromEntries(
  Object.entries(EN_NG).map(([k, v]) => [k, pseudo(v as never)]),
) as unknown as CatalogShape;

describe('wave C (account) renders in the pseudo locale', () => {
  it('the account navigation shows pseudo labels, no English and no raw key', () => {
    render(
      <I18nProvider locale="xx" catalog={PSEUDO}>
        <AccountNav />
      </I18nProvider>,
    );
    const text = document.body.textContent ?? '';
    expect(text).toContain(pseudo(EN_NG['account.nav.overview']));
    for (const english of ['Overview', 'Security', 'Playback settings', 'Data and privacy']) {
      expect(text).not.toContain(english);
    }
    expect(text).not.toMatch(/account\.nav\./);
  });
});
