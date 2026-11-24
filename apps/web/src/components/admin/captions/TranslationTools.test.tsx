// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { TranslationTools } from './TranslationTools';

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

const actions = () => ({
  estimate: vi.fn().mockResolvedValue({ configured: true, supported: true, provider: 'google', sourceLanguage: 'en', cues: 3, characters: 100, estimatedUsd: 0.01 }),
  start: vi.fn().mockResolvedValue({ ok: true }),
  publish: vi.fn().mockResolvedValue({ ok: true }),
});

describe('TranslationTools (M46-S15)', () => {
  it('on the spoken language it offers Add translation and no publish switch', () => {
    render(<TranslationTools spoken="en" current="en" available={['yo']} canTranslate canPublish approved published={false} actions={actions()} />);
    expect(screen.getByRole('button', { name: 'Add translation' })).toBeTruthy();
    expect(screen.queryByRole('switch')).toBeNull();
  });

  it('on a translation it shows the publish switch for that language', () => {
    render(<TranslationTools spoken="en" current="yo" available={[]} canTranslate canPublish approved published={false} actions={actions()} />);
    expect(screen.getByRole('switch', { name: 'Show Yoruba captions to viewers' })).toBeTruthy();
  });

  it('an Analyst style role without translate permission gets no Add translation', () => {
    render(<TranslationTools spoken="en" current="en" available={['yo']} canTranslate={false} canPublish={false} approved published={false} actions={actions()} />);
    expect(screen.queryByRole('button', { name: 'Add translation' })).toBeNull();
  });

  it('Add translation opens the dialog and returns focus on close', async () => {
    render(<TranslationTools spoken="en" current="en" available={['yo']} canTranslate canPublish approved published={false} actions={actions()} />);
    const trigger = screen.getByRole('button', { name: 'Add translation' });
    fireEvent.click(trigger);
    expect(await screen.findByRole('dialog', { name: 'Add a translation' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
