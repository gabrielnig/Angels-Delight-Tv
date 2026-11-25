import { describe, expect, it } from 'vitest';
import { interpretStep, parseArticle, roleAllows } from './fact-check';

describe('parseArticle', () => {
  const md = [
    '---',
    'id: D02',
    'title: Upload one video',
    'role: editor',
    'screens: ["/admin/videos/upload"]',
    '---',
    '## What you will do',
    'Add a video.',
    '',
    '## Steps',
    '1. Click **Upload** in the side menu.',
    '   ![A picture](../../media/D02/D02-01-upload-desktop.webp)',
    '2. Wait until the row says **Done**.',
    '   > [!CAREFUL]',
    '   > Keep this page open.',
    '3. Click **Edit details** to add the title.',
    '',
    '## What you should see',
    '1. Not a step.',
  ].join('\n');

  it('reads the id, role and only the numbered steps of the Steps section', () => {
    const a = parseArticle(md);
    expect(a.id).toBe('D02');
    expect(a.role).toBe('editor');
    expect(a.steps).toEqual([
      { n: 1, text: 'Click **Upload** in the side menu.' },
      { n: 2, text: 'Wait until the row says **Done**.' },
      { n: 3, text: 'Click **Edit details** to add the title.' },
    ]);
  });

  it('reads the steps between the kb:steps markers when they exist', () => {
    const a = parseArticle(
      md
        .replace('## Steps\n', '## Steps\nIntro text.\n<!-- kb:steps D02 -->\n')
        .replace('\n\n## What you should see', '\n<!-- /kb:steps -->\n\n## What you should see'),
    );
    expect(a.steps).toHaveLength(3);
  });

  it('fails clearly without a Steps section or a role', () => {
    expect(() => parseArticle('---\nid: D02\nrole: editor\n---\n## What you will do\nx')).toThrow(
      /Steps/,
    );
    expect(() => parseArticle('---\nid: D02\n---\n## Steps\n1. Click **A**.')).toThrow(/role/);
  });
});

describe('interpretStep', () => {
  it.each([
    ['Click **Upload** in the side menu.', { kind: 'menu', label: 'Upload' }],
    ['Choose **Videos** in the side menu.', { kind: 'menu', label: 'Videos' }],
    ['Click **Edit details** to add the title.', { kind: 'click', label: 'Edit details' }],
    ['Choose **Sign in**.', { kind: 'click', label: 'Sign in' }],
    ['Open the **Captions** tab.', { kind: 'click', label: 'Captions' }],
    ['Press **Verify**.', { kind: 'click', label: 'Verify' }],
    [
      'Type "Staying Safe Online" in the **Title** box.',
      { kind: 'type', label: 'Title', text: 'Staying Safe Online' },
    ],
    ['Type your email in the **Email** box.', { kind: 'unclear' }],
    ['Tick **Compact rows**.', { kind: 'check', label: 'Compact rows', on: true }],
    ['Untick **Compact rows**.', { kind: 'check', label: 'Compact rows', on: false }],
    [
      'Select **Published** from the **Status** list.',
      { kind: 'select', label: 'Status', option: 'Published' },
    ],
    ['Wait until the row says **Done**.', { kind: 'see', text: 'Done' }],
    ['Check that the page says **Dashboard**.', { kind: 'see', text: 'Dashboard' }],
    ['You see **Saved**.', { kind: 'see', text: 'Saved' }],
    ['Scroll to **Home preview clip**.', { kind: 'scroll', text: 'Home preview clip' }],
    ['Drag your video onto the box.', { kind: 'manual' }],
    ['Choose a file from your computer.', { kind: 'manual' }],
  ])('%s', (text, expected) => {
    expect(interpretStep(text)).toMatchObject(expected);
  });

  it('says what is wrong when a step cannot be followed mechanically', () => {
    const r = interpretStep('Open the menu and pick something.');
    expect(r.kind).toBe('unclear');
    expect((r as { reason: string }).reason).toMatch(/bold/);
  });

  it('rejects a step with two actions', () => {
    const r = interpretStep('Click **Upload** and then click **Done**.');
    expect(r.kind).toBe('unclear');
    expect((r as { reason: string }).reason).toMatch(/one action/);
  });

  it('treats a number of different bold labels in a click as unclear', () => {
    expect(interpretStep('Click **Upload** or **Done**.').kind).toBe('unclear');
  });
});

describe('roleAllows', () => {
  it('compares the run role with the lowest role of the article', () => {
    expect(roleAllows('admin', 'editor')).toBe(true);
    expect(roleAllows('editor', 'editor')).toBe(true);
    expect(roleAllows('editor', 'admin')).toBe(false);
    expect(roleAllows('super_admin', 'admin')).toBe(true);
    expect(roleAllows('editor', 'super_admin')).toBe(false);
  });
});
