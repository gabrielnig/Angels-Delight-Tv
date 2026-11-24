// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react';
import { EN_NG, pseudo, type CatalogShape } from '@ad/shared/messages';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SlowDown } from '../../components/browse/SlowDown';
import { ExpandableText } from '../../components/title/ExpandableText';
import { I18nProvider } from './provider';

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: () => {} }) }));
afterEach(cleanup);

const PSEUDO = Object.fromEntries(
  Object.entries(EN_NG).map(([k, v]) => [k, pseudo(v as never)]),
) as unknown as CatalogShape;

const inPseudo = (node: React.ReactNode) =>
  render(
    <I18nProvider locale="xx" catalog={PSEUDO}>
      {node}
    </I18nProvider>,
  );

describe('wave B (discovery) renders in the pseudo locale', () => {
  it('SlowDown shows pseudo text with the count kept and no English or raw key', () => {
    inPseudo(<SlowDown seconds={3} onReady={() => {}} />);
    const text = document.body.textContent ?? '';
    expect(text).not.toContain('Slow down a little');
    expect(text).not.toMatch(/browse\./);
    expect(text).toContain('3');
  });
  it('Show more on a long text is pseudo text', () => {
    inPseudo(<ExpandableText text={'word '.repeat(60)} />);
    const text = document.body.textContent ?? '';
    expect(text).not.toContain('Show more');
    expect(text).not.toMatch(/title\./);
  });
});
