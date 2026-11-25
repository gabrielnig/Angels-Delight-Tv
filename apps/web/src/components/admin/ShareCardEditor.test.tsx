// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import type { ComponentProps } from 'react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ShareCardEditor } from './ShareCardEditor';
import { ToastProvider } from './Toast';

const base = {
  title: 'Rivers of Nigeria',
  description: 'Where the rivers start.',
  siteName: 'Test TV',
  origin: 'https://learn.example.ng',
  imageUrl: '/og/title/rivers',
  initial: { title: null, description: null },
};

type Save = ComponentProps<typeof ShareCardEditor>['save'];

function setup(save: Save = vi.fn(async () => ({ ok: true as const }))) {
  render(
    <ToastProvider>
      <ShareCardEditor {...base} save={save} />
    </ToastProvider>,
  );
  return save;
}

afterEach(cleanup);

describe('ShareCardEditor (M45-S23)', () => {
  it('shows a WhatsApp, Facebook and X card that follow the title when nothing is set', () => {
    setup();
    for (const name of ['WhatsApp', 'Facebook', 'X']) {
      const card = screen.getByRole('region', { name: `${name} preview` });
      expect(card).toHaveTextContent('Rivers of Nigeria');
      expect(card).toHaveTextContent('learn.example.ng');
    }
  });

  it('updates every card as the editor types', async () => {
    setup();
    await userEvent.type(screen.getByLabelText('Share title'), 'Rivers, told well');
    expect(screen.getByRole('region', { name: 'Facebook preview' })).toHaveTextContent('Rivers, told well');
    expect(screen.getByRole('region', { name: 'X preview' })).toHaveTextContent('Rivers, told well');
  });

  it('says so when a platform will cut the text', async () => {
    setup();
    await userEvent.type(screen.getByLabelText('Share title'), 'A long share title that goes on and on and on for quite a while longer than anyone reads');
    expect(screen.getByRole('region', { name: 'WhatsApp preview' })).toHaveTextContent('so the end is cut');
  });

  it('blocks saving a title over 90 characters with a message', async () => {
    setup();
    await userEvent.type(screen.getByLabelText('Share title'), 'x'.repeat(91));
    expect(screen.getByText(/at most/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save share card' })).toBeDisabled();
  });

  it('saves the typed words and confirms', async () => {
    const save = setup();
    await userEvent.type(screen.getByLabelText('Share title'), 'Hello');
    await userEvent.click(screen.getByRole('button', { name: 'Save share card' }));
    expect(save).toHaveBeenCalledWith({ title: 'Hello', description: '' });
    expect(await screen.findByText(/Share card saved/)).toBeInTheDocument();
  });

  it('shows a server error under the form', async () => {
    const save: Save = vi.fn(async () => ({ ok: false as const, errors: { form: 'Saving share text needs the real database.' } }));
    setup(save);
    await userEvent.type(screen.getByLabelText('Share title'), 'Hi');
    await userEvent.click(screen.getByRole('button', { name: 'Save share card' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('needs the real database');
  });
});
