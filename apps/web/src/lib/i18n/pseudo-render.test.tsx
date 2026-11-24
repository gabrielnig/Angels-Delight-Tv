// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { EN_NG, pseudo, type CatalogShape } from '@ad/shared/messages';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { KidsExitDialog } from '../../components/KidsExitDialog';
import { I18nProvider } from './provider';

vi.mock('../../app/actions', () => ({ checkKidsPasswordAction: vi.fn() }));
afterEach(cleanup);

const PSEUDO = Object.fromEntries(
  Object.entries(EN_NG).map(([k, v]) => [k, pseudo(v as never)]),
) as unknown as CatalogShape;

describe('wave A renders in the pseudo locale', () => {
  it('the Kids exit dialog shows no English and no raw key', () => {
    render(
      <I18nProvider locale="xx" catalog={PSEUDO}>
        <KidsExitDialog open onClose={() => {}} onUnlocked={() => {}} />
      </I18nProvider>,
    );
    const text = document.body.textContent ?? '';
    expect(text).not.toContain('Leave Kids mode');
    expect(text).not.toContain('Continue');
    expect(text).not.toMatch(/kidsExit\./);
    expect(screen.getByRole('dialog').textContent).toContain(pseudo(EN_NG['kidsExit.title']));
  });
  it('the same dialog reads English without a provider', () => {
    render(<KidsExitDialog open onClose={() => {}} onUnlocked={() => {}} />);
    expect(document.body.textContent).toContain(EN_NG['kidsExit.title']);
  });
});
