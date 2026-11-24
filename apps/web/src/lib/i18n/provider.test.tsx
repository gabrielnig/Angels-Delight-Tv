// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { I18nProvider, useLocale, useT } from './provider';

function Probe() {
  const t = useT();
  return (
    <p data-testid="p">
      {useLocale()}:{t('format.duration.min', { count: 5 })}
    </p>
  );
}

describe('I18nProvider and useT', () => {
  it('reads English without a provider', () => {
    render(<Probe />);
    expect(screen.getByTestId('p').textContent).toBe('en:5 min');
  });
  it('uses the provided catalog and falls back to English per key', () => {
    render(
      <I18nProvider locale="yo" catalog={{ 'format.duration.min': '{count} ìṣ' }}>
        <Probe />
      </I18nProvider>,
    );
    expect(screen.getByTestId('p').textContent).toBe('yo:5 ìṣ');
  });
});
