import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Checkbox, Input, Select, Switch, Textarea } from './Field';

describe('Input', () => {
  it('has a visible label tied to the input', () => {
    render(<Input label="Email" type="email" />);
    expect(screen.getByLabelText('Email')).toHaveAttribute('type', 'email');
  });

  it('says required or optional in the label text', () => {
    const { rerender } = render(<Input label="Name" required />);
    expect(screen.getByText('(required)')).toBeInTheDocument();
    rerender(<Input label="Name" optional />);
    expect(screen.getByText('(optional)')).toBeInTheDocument();
  });

  it('links helper text with aria-describedby', () => {
    render(<Input label="Name" hint="Up to 20 characters" />);
    const input = screen.getByLabelText('Name');
    const hint = screen.getByText('Up to 20 characters');
    expect(input.getAttribute('aria-describedby')).toContain(hint.id);
  });

  it('marks the input invalid and links the error message', () => {
    render(<Input label="Email" error="Enter an email like name@example.com." />);
    const input = screen.getByLabelText('Email');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    const message = screen.getByText('Enter an email like name@example.com.');
    expect(input.getAttribute('aria-describedby')).toContain(message.id);
  });

  it('does not set aria-invalid without an error', () => {
    render(<Input label="Email" />);
    expect(screen.getByLabelText('Email')).not.toHaveAttribute('aria-invalid');
  });

  it('shows a busy state while checking', () => {
    render(<Input label="Name" loading />);
    expect(screen.getByLabelText('Name')).toHaveAttribute('aria-busy', 'true');
  });

  it('disables the control', () => {
    render(<Input label="Name" disabled />);
    expect(screen.getByLabelText('Name')).toBeDisabled();
  });

  it('forwards typing', async () => {
    const onChange = vi.fn();
    render(<Input label="Name" onChange={onChange} />);
    await userEvent.setup().type(screen.getByLabelText('Name'), 'Ada');
    expect(onChange).toHaveBeenCalledTimes(3);
  });
});

describe('Textarea', () => {
  it('is labelled and reports errors', () => {
    render(<Textarea label="Message" error="Write a message." />);
    expect(screen.getByLabelText('Message')).toHaveAttribute('aria-invalid', 'true');
  });
});

describe('Checkbox', () => {
  it('toggles from the label', async () => {
    const user = userEvent.setup();
    render(<Checkbox label="Kids profile" />);
    await user.click(screen.getByText('Kids profile'));
    expect(screen.getByRole('checkbox', { name: 'Kids profile' })).toBeChecked();
  });
});

describe('Switch', () => {
  it('uses the switch role with an On or Off state word', async () => {
    const user = userEvent.setup();
    const onCheckedChange = vi.fn();
    const { rerender } = render(
      <Switch label="Autoplay next" checked={false} onCheckedChange={onCheckedChange} />,
    );
    const control = screen.getByRole('switch', { name: 'Autoplay next' });
    expect(control).toHaveAttribute('aria-checked', 'false');
    expect(screen.getByText('Off')).toBeInTheDocument();
    await user.click(control);
    expect(onCheckedChange).toHaveBeenCalledWith(true);
    rerender(<Switch label="Autoplay next" checked onCheckedChange={onCheckedChange} />);
    expect(screen.getByText('On')).toBeInTheDocument();
  });

  it('toggles with the keyboard', async () => {
    const user = userEvent.setup();
    const onCheckedChange = vi.fn();
    render(<Switch label="Data saver" checked={false} onCheckedChange={onCheckedChange} />);
    await user.tab();
    await user.keyboard(' ');
    expect(onCheckedChange).toHaveBeenCalledWith(true);
  });
});

describe('Select', () => {
  it('is a labelled native select with options', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <Select label="Language" value="en" onChange={onChange}>
        <option value="en">English</option>
        <option value="yo">Yoruba</option>
      </Select>,
    );
    const select = screen.getByLabelText('Language');
    expect(select.tagName).toBe('SELECT');
    await user.selectOptions(select, 'yo');
    expect(onChange).toHaveBeenCalled();
  });

  it('reports an error', () => {
    render(
      <Select label="Language" error="Choose a language." defaultValue="">
        <option value="">Pick one</option>
      </Select>,
    );
    expect(screen.getByLabelText('Language')).toHaveAttribute('aria-invalid', 'true');
  });
});
