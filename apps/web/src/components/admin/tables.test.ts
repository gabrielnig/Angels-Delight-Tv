import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const dir = new URL('.', import.meta.url).pathname;

function source(file: string): string {
  return readFileSync(join(dir, file), 'utf8');
}

function walk(root: string): string[] {
  return readdirSync(root).flatMap((name) => {
    const full = join(root, name);
    if (statSync(full).isDirectory()) return walk(full);
    return /\.tsx$/.test(name) && !/\.test\./.test(name) ? [full] : [];
  });
}

/** The className on the header cell whose text is `label`, or null. */
function headerClass(src: string, label: string): string | null {
  const re = new RegExp(`<th scope="col"([^>]*)>\\s*${label}\\s*</th>`);
  const m = re.exec(src);
  if (!m) throw new Error(`header ${label} not found`);
  const c = /className="([^"]*)"/.exec(m[1] ?? '');
  return c ? (c[1] ?? null) : null;
}

describe('tables are never forced to display table with an inline style', () => {
  it('uses the adm-table--always class instead', () => {
    const offenders = walk(dir).filter((f) => /style=\{\{\s*display:\s*'table'\s*\}\}/.test(readFileSync(f, 'utf8')));
    expect(offenders).toEqual([]);
  });
});

describe('numeric columns share one class in header and cells', () => {
  const cases: Array<[string, string, string]> = [
    ['CaptionList.tsx', 'Cues', 'adm-num'],
    ['TrashList.tsx', 'Days left', 'adm-num'],
    ['UsersTable.tsx', 'Profiles', 'adm-num'],
    ['ExportsView.tsx', 'Rows', 'adm-num'],
    ['ExportsView.tsx', 'Size', 'adm-num'],
    ['site/InviteCodesTab.tsx', 'Uses', 'adm-num'],
    ['SystemView.tsx', 'Times', 'adm-num'],
    ['AnalyticsView.tsx', 'Views', 'adm-num'],
    ['VideosList.tsx', 'Views', 'adm-num'],
    ['RolesInvites.tsx', 'Editor', 'adm-ctr'],
    ['RolesInvites.tsx', 'Admin', 'adm-ctr'],
    ['RolesInvites.tsx', 'Super admin', 'adm-ctr'],
  ];
  it.each(cases)('%s %s header is %s', (file, label, cls) => {
    const src = source(file);
    const re = new RegExp(`<th scope="col"([^>]*)>\\s*(?:[^<]*)?${label}`);
    // header may carry the class on the th itself
    const m = re.exec(src);
    expect(m, `${label} header`).not.toBeNull();
    expect(`${m?.[1] ?? ''}`).toContain(cls);
  });

  it('Exports Rows and Size cells are numeric', () => {
    const src = source('ExportsView.tsx');
    expect(src).toMatch(/<td className="adm-num">\{item\.rows/);
    expect(src).toMatch(/<td className="adm-num">\{size\(item\.bytes\)\}/);
  });

  it('Invite codes Uses cell is numeric', () => {
    expect(source('site/InviteCodesTab.tsx')).toMatch(/<td className="adm-num">\s*\{item\.uses\}/);
  });

  it('Roles matrix cells are centred', () => {
    expect(source('RolesInvites.tsx')).toMatch(/<td key=\{r\} className="adm-ctr">/);
  });

  it('headerClass helper finds the class', () => {
    expect(headerClass('<th scope="col" className="adm-num">Cues</th>', 'Cues')).toBe('adm-num');
  });
});
