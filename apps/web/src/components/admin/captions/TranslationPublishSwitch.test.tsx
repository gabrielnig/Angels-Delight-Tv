// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { TranslationPublishSwitch } from './TranslationPublishSwitch';

describe('TranslationPublishSwitch (M46-S15)', () => {
  it('is disabled until the track is approved, and says why', () => {
    render(<TranslationPublishSwitch language="yo" approved={false} published={false} canPublish onChange={vi.fn()} />);
    expect(screen.getByRole('switch', { name: 'Show Yoruba captions to viewers' }).hasAttribute('disabled')).toBe(true);
    expect(screen.getByText('Approve the captions first. Viewers will not see them until you publish.')).toBeTruthy();
  });

  it('an Editor sees it disabled with the permission reason', () => {
    render(<TranslationPublishSwitch language="yo" approved published={false} canPublish={false} onChange={vi.fn()} />);
    expect(screen.getByRole('switch').hasAttribute('disabled')).toBe(true);
    expect(screen.getByText('Only an admin can publish a language.')).toBeTruthy();
  });

  it('an Admin turns it on and the result is reported', async () => {
    const onChange = vi.fn().mockResolvedValue({ ok: true });
    render(<TranslationPublishSwitch language="yo" approved published={false} canPublish onChange={onChange} />);
    fireEvent.click(screen.getByRole('switch'));
    await waitFor(() => expect(onChange).toHaveBeenCalledWith(true));
    expect(screen.getByRole('switch').getAttribute('aria-checked')).toBe('true');
  });

  it('a refusal puts the switch back and shows the plain reason', async () => {
    const onChange = vi.fn().mockResolvedValue({ ok: false, error: 'Approve the captions in this language before publishing them.' });
    render(<TranslationPublishSwitch language="yo" approved published={false} canPublish onChange={onChange} />);
    fireEvent.click(screen.getByRole('switch'));
    await waitFor(() => expect(screen.getByRole('alert').textContent).toMatch(/Approve the captions/));
    expect(screen.getByRole('switch').getAttribute('aria-checked')).toBe('false');
  });
});
