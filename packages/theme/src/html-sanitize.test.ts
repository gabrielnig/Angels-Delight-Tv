import { describe, expect, it } from 'vitest';
import { isPlaceholderBody, sanitizeHtml, stripToText } from './html-sanitize';

describe('sanitizeHtml keeps the safe subset', () => {
  it.each([
    ['<p>Hello</p>', '<p>Hello</p>'],
    ['<h2>Title</h2><p>Text</p>', '<h2>Title</h2><p>Text</p>'],
    ['<ul><li>One</li><li>Two</li></ul>', '<ul><li>One</li><li>Two</li></ul>'],
    ['<ol><li>One</li></ol>', '<ol><li>One</li></ol>'],
    [
      '<p><strong>Bold</strong> and <em>italic</em></p>',
      '<p><strong>Bold</strong> and <em>italic</em></p>',
    ],
    ['<p><b>Bold</b> <i>it</i></p>', '<p><strong>Bold</strong> <em>it</em></p>'],
    ['<p>Line<br>break</p>', '<p>Line<br>break</p>'],
    ['<blockquote>Quote</blockquote>', '<blockquote>Quote</blockquote>'],
    ['<P CLASS="x">Upper</P>', '<p>Upper</p>'],
    ['Plain text', 'Plain text'],
    ['<p>Tom &amp; Jerry &copy; 2026</p>', '<p>Tom &amp; Jerry &copy; 2026</p>'],
  ])('%s', (input, output) => {
    expect(sanitizeHtml(input)).toBe(output);
  });
});

describe('sanitizeHtml links', () => {
  it.each([
    [
      '<a href="https://example.com/a?b=1&c=2">x</a>',
      '<a href="https://example.com/a?b=1&amp;c=2" rel="noopener noreferrer">x</a>',
    ],
    [
      '<a href="mailto:help@angelsdelight.tv">mail</a>',
      '<a href="mailto:help@angelsdelight.tv" rel="noopener noreferrer">mail</a>',
    ],
    ['<a href="/about">about</a>', '<a href="/about" rel="noopener noreferrer">about</a>'],
    [
      "<a href='https://x.test' onclick='evil()'>x</a>",
      '<a href="https://x.test" rel="noopener noreferrer">x</a>',
    ],
  ])('keeps %s', (input, output) => {
    expect(sanitizeHtml(input)).toBe(output);
  });

  it.each([
    '<a href="javascript:alert(1)">x</a>',
    '<a href="JaVaScRiPt:alert(1)">x</a>',
    '<a href="  javascript:alert(1)">x</a>',
    '<a href="java\tscript:alert(1)">x</a>',
    '<a href="jav&#x61;script:alert(1)">x</a>',
    '<a href="jav&#97;script:alert(1)">x</a>',
    '<a href="javascript&colon;alert(1)">x</a>',
    '<a href="data:text/html;base64,PHNjcmlwdD4=">x</a>',
    '<a href="vbscript:msgbox(1)">x</a>',
    '<a href="//evil.example">x</a>',
    '<a href=javascript:alert(1)>x</a>',
  ])('drops the href of %s', (input) => {
    expect(sanitizeHtml(input)).toBe('<a rel="noopener noreferrer">x</a>');
  });
});

describe('sanitizeHtml removes dangerous content', () => {
  it.each([
    ['<script>alert(1)</script><p>ok</p>', '<p>ok</p>'],
    ['<SCRIPT SRC=//evil.test/x.js></SCRIPT>ok', 'ok'],
    ['<style>body{display:none}</style>ok', 'ok'],
    ['<iframe src="https://evil.test"></iframe>ok', 'ok'],
    ['<object data="x"></object>ok', 'ok'],
    ['<img src=x onerror=alert(1)>ok', 'ok'],
    ['<svg onload=alert(1)><circle/></svg>ok', 'ok'],
    ['<p onclick="alert(1)">x</p>', '<p>x</p>'],
    ['<p style="position:fixed">x</p>', '<p>x</p>'],
    ['<form action="/x"><input name=a></form>ok', 'ok'],
    ['<!-- comment --><p>x</p>', '<p>x</p>'],
    ['<math><mi>x</mi></math>ok', 'ok'],
    ['<script>alert(1)', ''],
    ['<p>1 < 2 and 3 > 2</p>', '<p>1 &lt; 2 and 3 &gt; 2</p>'],
    ['<div><span>kept text</span></div>', 'kept text'],
    ['<p>"quoted" \'single\'</p>', '<p>&quot;quoted&quot; &#39;single&#39;</p>'],
  ])('%s', (input, output) => {
    expect(sanitizeHtml(input)).toBe(output);
  });

  it('never emits a script, event handler or style attribute for a pile of vectors', () => {
    const vectors = [
      '<img src="x" onerror="alert(1)">',
      '<a href="x" onmouseover="alert(1)">x</a>',
      '<body onload=alert(1)>',
      '<p/onclick=alert(1)>x</p>',
      '<a href="x"\nonclick="alert(1)">x</a>',
      '<<img src=x onerror=alert(1)>',
      '<p title="</p><script>alert(1)</script>">x</p>',
      '<noscript><p title="</noscript><img src=x onerror=alert(1)>">',
      '<<script>alert(1)//<</script>',
      '<p>a</p><script',
    ];
    for (const vector of vectors) {
      const output = sanitizeHtml(vector);
      expect(output).not.toMatch(/<script|<[^>]*\son\w+\s*=|style\s*=|<img|<svg/i);
    }
  });

  it('closes unbalanced tags and ignores stray closers', () => {
    expect(sanitizeHtml('<p><strong>open')).toBe('<p><strong>open</strong></p>');
    expect(sanitizeHtml('text</p></ul>')).toBe('text');
  });

  it('is idempotent', () => {
    const once = sanitizeHtml(
      '<p onclick="x">a &amp; <a href="javascript:1">b</a><script>x</script></p>',
    );
    expect(sanitizeHtml(once)).toBe(once);
  });

  it('handles non string input and very long input', () => {
    expect(sanitizeHtml(undefined as unknown as string)).toBe('');
    expect(sanitizeHtml('<p>' + 'a'.repeat(200_000) + '</p>').length).toBeGreaterThan(100_000);
  });
});

describe('stripToText and placeholders', () => {
  it('strips tags', () => {
    expect(stripToText('<h2>Hi</h2><p>there &amp; you</p>')).toBe('Hi there & you');
  });

  it.each([
    ['', true],
    ['   ', true],
    ['<p></p>', true],
    ['<p>[Add your terms of use here before launch]</p>', true],
    ['<p>[Add your privacy policy here]</p>', true],
    ['<p>Placeholder text</p>', true],
    ['<p>Real terms apply.</p>', false],
    ['<p>Please add your own name to the list.</p>', false],
  ])('isPlaceholderBody(%j) is %s', (body, expected) => {
    expect(isPlaceholderBody(body)).toBe(expected);
  });
});
