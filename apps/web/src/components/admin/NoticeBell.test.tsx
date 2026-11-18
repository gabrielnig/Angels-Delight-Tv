// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { NoticeBell } from './NoticeBell';

const items = [
  {
    id: 'a',
    title: 'Captions ready to review',
    body: 'Fractions',
    href: '/admin/captions/a',
    createdAt: '2026-11-17T08:00:00Z',
    read: false,
  },
  {
    id: 'b',
    title: 'Video is ready',
    body: 'Rain',
    href: null,
    createdAt: '2026-11-16T08:00:00Z',
    read: true,
  },
];

describe('NoticeBell', () => {
  it('names the unread count on the button and opens the list', async () => {
    render(<NoticeBell items={items} unread={1} markAllRead={async () => {}} />);
    const button = screen.getByRole('button', { name: 'Notifications, 1 unread' });
    expect(button).toHaveAttribute('aria-expanded', 'false');
    await userEvent.click(button);
    expect(screen.getByRole('link', { name: /Captions ready to review/ })).toHaveAttribute(
      'href',
      '/admin/captions/a',
    );
    expect(screen.getByText('Video is ready')).toBeInTheDocument();
  });

  it('clears the badge after Mark all as read', async () => {
    const markAllRead = vi.fn(async () => {});
    render(<NoticeBell items={items} unread={1} markAllRead={markAllRead} />);
    await userEvent.click(screen.getByRole('button', { name: /Notifications, 1 unread/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Mark all as read' }));
    expect(markAllRead).toHaveBeenCalledOnce();
    expect(await screen.findByRole('button', { name: 'Notifications' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Mark all as read' })).toBeDisabled();
  });

  it('says Nothing new when empty, and disables Mark all as read', async () => {
    render(<NoticeBell items={[]} unread={0} markAllRead={async () => {}} />);
    await userEvent.click(screen.getByRole('button', { name: 'Notifications' }));
    expect(screen.getByText('Nothing new')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Mark all as read' })).toBeDisabled();
  });

  it('keeps the badge and shows an error when marking fails', async () => {
    render(
      <NoticeBell
        items={items}
        unread={1}
        markAllRead={async () => {
          throw new Error('down');
        }}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: /Notifications, 1 unread/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Mark all as read' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not mark them as read');
    expect(screen.getByRole('button', { name: /Notifications, 1 unread/ })).toBeInTheDocument();
  });

  it('closes on Escape and returns focus to the bell', async () => {
    render(<NoticeBell items={items} unread={1} markAllRead={async () => {}} />);
    const button = screen.getByRole('button', { name: /Notifications/ });
    await userEvent.click(button);
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('region', { name: 'Notifications' })).toBeNull();
    expect(button).toHaveFocus();
  });
});
