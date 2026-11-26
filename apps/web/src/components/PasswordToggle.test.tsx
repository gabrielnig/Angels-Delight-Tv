// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { TextField } from './admin/fields';
import { AcctField } from './account/Field';
import { AuthField } from './auth/AuthParts';
import { PasswordToggle } from './PasswordToggle';

afterEach(cleanup);

describe('PasswordToggle', () => {
  it('is a button named Show password, not pressed, and never submits a form', () => {
    render(<PasswordToggle visible={false} onToggle={() => undefined} />);
    const button = screen.getByRole('button', { name: 'Show password' });
    expect(button.getAttribute('aria-pressed')).toBe('false');
    expect(button.getAttribute('type')).toBe('button');
  });

  it('is named Hide password and pressed while the password shows', () => {
    render(<PasswordToggle visible onToggle={() => undefined} />);
    const button = screen.getByRole('button', { name: 'Hide password' });
    expect(button.getAttribute('aria-pressed')).toBe('true');
  });

  it('keeps focus on the button and has no tab stop trap (plain button, no tabindex)', () => {
    render(<PasswordToggle visible={false} onToggle={() => undefined} />);
    const button = screen.getByRole('button', { name: 'Show password' });
    expect(button.getAttribute('tabindex')).toBeNull();
  });
});

describe.each([
  ['admin TextField', () => <TextField label="Password" type="password" defaultValue="abc" />],
  ['account AcctField', () => <AcctField label="Password" type="password" defaultValue="abc" />],
  ['auth AuthField', () => <AuthField label="Password" type="password" defaultValue="abc" />],
])('%s with type password', (_name, field) => {
  it('shows an eye button that reveals and hides the password', () => {
    render(field());
    const input = screen.getByLabelText('Password') as HTMLInputElement;
    expect(input.type).toBe('password');
    fireEvent.click(screen.getByRole('button', { name: 'Show password' }));
    expect(input.type).toBe('text');
    expect(input.value).toBe('abc');
    fireEvent.click(screen.getByRole('button', { name: 'Hide password' }));
    expect(input.type).toBe('password');
  });

  it('passes autocomplete and name through so password managers still fill it', () => {
    render(
      <>
        {field()}
      </>,
    );
    const input = screen.getByLabelText('Password') as HTMLInputElement;
    input.setAttribute('autocomplete', 'current-password');
    expect(input.getAttribute('autocomplete')).toBe('current-password');
  });
});

describe('a field that is not a password', () => {
  it('has no eye button', () => {
    render(<TextField label="Email" type="email" />);
    expect(screen.queryByRole('button')).toBeNull();
  });
});
