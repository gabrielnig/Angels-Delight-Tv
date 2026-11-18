#!/usr/bin/env node
// Software bill of materials (CycloneDX 1.5) for everything the shipped apps depend on at runtime.
// cyclonedx-npm and cdxgen read npm layouts and see almost nothing in a pnpm workspace, so this reads
// `pnpm list -r --prod` instead. Usage: node scripts/sbom.mjs [output.json]
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';

function walk(deps, found) {
  for (const [name, info] of Object.entries(deps ?? {})) {
    const version = info?.version;
    if (
      typeof version === 'string' &&
      !version.startsWith('link:') &&
      !version.startsWith('file:')
    ) {
      found.set(`${name}@${version}`, { name, version });
    }
    walk(info?.dependencies, found);
  }
}

export function toCycloneDx(trees, meta) {
  const found = new Map();
  for (const tree of trees) walk(tree.dependencies, found);
  const components = [...found.values()]
    .map(({ name, version }) => ({
      type: 'library',
      name,
      version,
      purl: `pkg:npm/${name.replace(/^@/, '%40')}@${version}`,
    }))
    .sort((a, b) => a.purl.localeCompare(b.purl));
  return {
    bomFormat: 'CycloneDX',
    specVersion: '1.5',
    version: 1,
    metadata: {
      timestamp: meta.timestamp,
      component: { type: 'application', name: meta.name, version: meta.version },
    },
    components,
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const out = process.argv[2] ?? 'sbom.cdx.json';
  const trees = JSON.parse(
    execFileSync('pnpm', ['list', '-r', '--prod', '--json', '--depth', 'Infinity'], {
      encoding: 'utf8',
      maxBuffer: 256 * 1024 * 1024,
    }),
  );
  const root = JSON.parse(readFileSync('package.json', 'utf8'));
  const bom = toCycloneDx(trees, {
    name: root.name,
    version: root.version ?? '0.0.0',
    timestamp: new Date().toISOString(),
  });
  writeFileSync(out, `${JSON.stringify(bom, null, 2)}\n`);
  console.log(`sbom: ${bom.components.length} components written to ${out}`);
}
