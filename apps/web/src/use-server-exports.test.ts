import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';

const SRC = fileURLToPath(new URL('.', import.meta.url));

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name)) out.push(full);
  }
  return out;
}

function hasUseServer(sf: ts.SourceFile): boolean {
  for (const st of sf.statements) {
    if (ts.isExpressionStatement(st) && ts.isStringLiteral(st.expression)) {
      if (st.expression.text === 'use server') return true;
    } else break;
  }
  return false;
}

const isAsync = (n: ts.Node) => !!ts.getModifiers(n as ts.HasModifiers)?.some((m) => m.kind === ts.SyntaxKind.AsyncKeyword);
const hasExport = (n: ts.Node) => !!ts.getModifiers(n as ts.HasModifiers)?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword);

function unwrap(e: ts.Expression): ts.Expression {
  while (ts.isParenthesizedExpression(e) || ts.isAsExpression(e) || ts.isSatisfiesExpression(e)) e = e.expression;
  return e;
}

/** Returns a description of every export that Next.js would reject in a 'use server' file. */
export function badServerExports(source: string, name = 'file.ts'): string[] {
  const sf = ts.createSourceFile(name, source, ts.ScriptTarget.Latest, true);
  if (!hasUseServer(sf)) return [];
  const bad: string[] = [];
  for (const st of sf.statements) {
    if (ts.isInterfaceDeclaration(st) || ts.isTypeAliasDeclaration(st)) continue;
    if (ts.isFunctionDeclaration(st) && hasExport(st)) {
      if (!isAsync(st)) bad.push(`sync function ${st.name?.text ?? 'default'}`);
    } else if (ts.isVariableStatement(st) && hasExport(st)) {
      for (const d of st.declarationList.declarations) {
        const init = d.initializer && unwrap(d.initializer);
        const ok = init && ts.isArrowFunction(init) && isAsync(init);
        const ok2 = init && ts.isFunctionExpression(init) && isAsync(init);
        if (!ok && !ok2) bad.push(`non-async export ${d.name.getText(sf)}`);
      }
    } else if (ts.isExportDeclaration(st)) {
      if (!st.isTypeOnly) bad.push('re-export');
    } else if (ts.isExportAssignment(st)) {
      const e = unwrap(st.expression);
      if (!(ts.isArrowFunction(e) && isAsync(e)) && !(ts.isFunctionExpression(e) && isAsync(e))) bad.push('default export is not async');
    } else if ((ts.isClassDeclaration(st) || ts.isEnumDeclaration(st) || ts.isModuleDeclaration(st)) && hasExport(st)) {
      bad.push('exported class, enum or namespace');
    }
  }
  return bad;
}

describe('use server files export only async functions', () => {
  it('flags bad exports in a sample', () => {
    const bad = badServerExports(
      `'use server';\nexport const a = 1;\nexport function b() {}\nexport const c = () => 1;\nexport { x } from './x';\nexport type T = string;\nexport async function ok() {}\nexport const ok2 = async () => 1;`,
    );
    expect(bad).toEqual(['non-async export a', 'sync function b', 'non-async export c', 're-export']);
  });

  it('ignores files without the directive', () => {
    expect(badServerExports(`export const a = 1;`)).toEqual([]);
  });

  it('has no offenders under apps/web/src', () => {
    const offenders: string[] = [];
    for (const file of walk(SRC)) {
      const text = readFileSync(file, 'utf8');
      if (!/^\s*(\/\*[\s\S]*?\*\/\s*|\/\/.*\n\s*)*['"]use server['"]/.test(text)) continue;
      for (const b of badServerExports(text, file)) offenders.push(`${relative(SRC, file)}: ${b}`);
    }
    expect(offenders).toEqual([]);
  });
});
