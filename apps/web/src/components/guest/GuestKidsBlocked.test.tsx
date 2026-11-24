// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

const refresh = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh, push: vi.fn() }) }));

import { GuestKidsBlocked } from './GuestKidsBlocked';

describe('GuestKidsBlocked', () => {
  it('says the video is not in Kids mode and offers Turn off Kids mode and Browse', async () => {
    const setKidsMode = vi.fn().mockResolvedValue(undefined);
    render(<GuestKidsBlocked setKidsMode={setKidsMode} />);
    expect(
      screen.getByRole('heading', { name: 'This video is not in Kids mode' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Browse' })).toHaveAttribute('href', '/browse');
    await userEvent.click(screen.getByRole('button', { name: 'Turn off Kids mode' }));
    expect(setKidsMode).toHaveBeenCalledWith(false);
    expect(refresh).toHaveBeenCalled();
  });
});
