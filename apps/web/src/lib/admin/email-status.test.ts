import { describe, expect, it } from 'vitest';
import { EMAIL_NOT_CONFIGURED_WARNING, emailNotConfigured } from './email-status';

describe('emailNotConfigured', () => {
  it('is true only for the disabled value', () => {
    expect(emailNotConfigured({ SMTP_URL: 'disabled' })).toBe(true);
    expect(emailNotConfigured({ SMTP_URL: ' Disabled ' })).toBe(true);
    expect(emailNotConfigured({ SMTP_URL: 'smtps://u:p@smtp.example.org:465' })).toBe(false);
    expect(emailNotConfigured({})).toBe(false);
  });

  it('has a plain warning that starts with the agreed sentence', () => {
    expect(EMAIL_NOT_CONFIGURED_WARNING).toMatch(/^Email is not configured/);
  });
});
