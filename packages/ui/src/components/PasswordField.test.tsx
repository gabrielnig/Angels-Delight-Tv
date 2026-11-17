import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { evaluatePassword, MIN_PASSWORD_LENGTH } from './password';
import { PasswordField } from './PasswordField';

function Controlled(props: Partial<React.ComponentProps<typeof PasswordField>>) {
  const [value, setValue] = useState('');
  return (
    <PasswordField
      label="Password"
      value={value}
      onChange={(event) => setValue(event.target.value)}
      scorer={async (pw) => (pw.length > 14 ? 4 : pw.length > 11 ? 3 : 1)}
      {...props}
    />
  );
}

describe('evaluatePassword', () => {
  it('requires 10 characters', () => {
    expect(MIN_PASSWORD_LENGTH).toBe(10);
    expect(evaluatePassword('short', 3).lengthOk).toBe(false);
    expect(evaluatePassword('longenough1', 3).lengthOk).toBe(true);
  });

  it('rejects common passwords case insensitively', () => {
    expect(evaluatePassword('Password123', 3).notCommon).toBe(false);
    expect(evaluatePassword('purple-river-lamp', 3).notCommon).toBe(true);
  });

  it('labels strength with a word', () => {
    expect(evaluatePassword('', 0).label).toBe('Too short');
    expect(evaluatePassword('abcdefghij', 0).label).toBe('Weak');
    expect(evaluatePassword('abcdefghij', 2).label).toBe('Okay');
    expect(evaluatePassword('abcdefghij', 4).label).toBe('Strong');
    expect(evaluatePassword('abcdefghij', 4).segments).toBe(4);
  });
});

describe('PasswordField', () => {
  it('hides the password by default and toggles visibility with aria-pressed', async () => {
    const user = userEvent.setup();
    render(<Controlled />);
    const input = screen.getByLabelText('Password');
    expect(input).toHaveAttribute('type', 'password');
    const toggle = screen.getByRole('button', { name: 'Show password' });
    expect(toggle).toHaveAttribute('aria-pressed', 'false');
    await user.click(toggle);
    expect(input).toHaveAttribute('type', 'text');
    expect(screen.getByRole('button', { name: 'Hide password' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  it('sets the right autocomplete for each mode', () => {
    const { rerender } = render(<Controlled mode="current" />);
    expect(screen.getByLabelText('Password')).toHaveAttribute('autocomplete', 'current-password');
    rerender(<Controlled mode="new" />);
    expect(screen.getByLabelText('Password')).toHaveAttribute('autocomplete', 'new-password');
  });

  it('shows no meter on sign in', () => {
    render(<Controlled mode="current" />);
    expect(screen.queryByText('Too short')).toBeNull();
  });

  it('shows a meter word and a live checklist on sign up', async () => {
    const user = userEvent.setup();
    render(<Controlled mode="new" showStrength />);
    expect(screen.getByText('Too short')).toBeInTheDocument();
    expect(screen.getByText('At least 10 characters')).toBeInTheDocument();
    expect(screen.getByText('Not a common password')).toBeInTheDocument();
    expect(screen.getByText('Better with a mix of words you can remember')).toBeInTheDocument();
    await user.type(screen.getByLabelText('Password'), 'purple river lamp tea');
    await waitFor(() => expect(screen.getByText('Strong')).toBeInTheDocument());
    const length = screen.getByText('At least 10 characters').closest('li');
    expect(length).toHaveAttribute('data-met', 'true');
    expect(length?.textContent).toContain('Done:');
  });

  it('does not block paste', async () => {
    const user = userEvent.setup();
    render(<Controlled mode="new" showStrength />);
    await user.click(screen.getByLabelText('Password'));
    await user.paste('a long pasted passphrase');
    expect(screen.getByLabelText('Password')).toHaveValue('a long pasted passphrase');
  });

  it('shows a caps lock hint', async () => {
    const user = userEvent.setup();
    render(<Controlled />);
    const input = screen.getByLabelText('Password');
    await user.click(input);
    input.dispatchEvent(
      Object.assign(new KeyboardEvent('keyup', { key: 'A', bubbles: true }), {
        getModifierState: (key: string) => key === 'CapsLock',
      }),
    );
    await waitFor(() => expect(screen.getByText('Caps Lock is on')).toBeInTheDocument());
  });

  it('reports an error message and invalid state', () => {
    render(<Controlled error="Use at least 10 characters." />);
    expect(screen.getByLabelText('Password')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByText('Use at least 10 characters.')).toBeInTheDocument();
  });
});
