import { describe, expect, it } from 'vitest';
import { applyFormat, applyLink, cleanLinkAddress } from './page-format';

describe('applyFormat', () => {
  it.each([
    ['bold', '<strong>world</strong>'],
    ['italic', '<em>world</em>'],
    ['h2', '<h2>world</h2>'],
  ] as const)('wraps the selection for %s', (format, wrapped) => {
    const edit = applyFormat('hello world!', 6, 11, format);
    expect(edit.text).toBe(`hello ${wrapped}!`);
    expect(edit.text.slice(edit.start, edit.end)).toBe('world');
  });

  it('inserts placeholder text when nothing is selected', () => {
    expect(applyFormat('ab', 1, 1, 'bold').text).toBe('a<strong>text</strong>b');
    expect(applyFormat('', 0, 0, 'h2').text).toBe('<h2>Heading</h2>');
  });

  it('turns selected lines into a bullet list, skipping blank lines', () => {
    const edit = applyFormat('One\n\nTwo\r\nThree', 0, 15, 'bullets');
    expect(edit.text).toBe('<ul><li>One</li><li>Two</li><li>Three</li></ul>');
  });

  it('starts a list when nothing is selected', () => {
    expect(applyFormat('', 0, 0, 'bullets').text).toBe('<ul><li>List item</li></ul>');
  });
});

describe('links', () => {
  it.each([
    ['https://angelsdelight.tv/help', 'https://angelsdelight.tv/help'],
    ['  mailto:help@angelsdelight.tv ', 'mailto:help@angelsdelight.tv'],
    ['/about', '/about'],
    ['http://example.test', 'http://example.test'],
  ])('keeps %s', (input, out) => {
    expect(cleanLinkAddress(input)).toBe(out);
  });

  it.each([
    'javascript:alert(1)',
    'data:text/html,x',
    '//evil.test',
    'https://x.test/"onmouseover="x',
    'ftp://x.test',
    'plain words',
    '',
  ])('refuses %s', (input) => {
    expect(cleanLinkAddress(input)).toBeNull();
    expect(applyLink('text', 0, 4, input)).toBeNull();
  });

  it('wraps the selection in an anchor', () => {
    const edit = applyLink('see the help page', 8, 12, 'https://angelsdelight.tv/help')!;
    expect(edit.text).toBe('see the <a href="https://angelsdelight.tv/help">help</a> page');
  });

  it('uses the address as the text when nothing is selected', () => {
    expect(applyLink('', 0, 0, '/about')!.text).toBe('<a href="/about">/about</a>');
  });
});
