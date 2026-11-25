/** Email redaction for screenshots and recordings. Pure part; the browser copy is built in overlay.ts. */

export const EMAIL_PATTERN = '[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\\.[A-Za-z0-9-]+)+';

export const FAKE_DOMAIN_PATTERN = '(?:^|\\.)example\\.(?:com|net|org|test)$|\\.invalid$';
const FAKE = new RegExp(FAKE_DOMAIN_PATTERN, 'i');

/** Reserved example domains (RFC 2606) are safe to show on screen. */
export function isFakeDomain(domain: string): boolean {
  return FAKE.test(domain.trim());
}

export const REDACTED = '[email hidden]';

export function redactEmails(text: string, o: { keepFake?: boolean } = {}): string {
  const keepFake = o.keepFake ?? true;
  return text.replace(new RegExp(EMAIL_PATTERN, 'g'), (m) => {
    const domain = m.slice(m.lastIndexOf('@') + 1);
    return keepFake && isFakeDomain(domain) ? m : REDACTED;
  });
}
