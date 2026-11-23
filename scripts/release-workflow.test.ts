import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = resolve(import.meta.dirname, '..');
const release = readFileSync(resolve(root, '.github/workflows/release.yml'), 'utf8');

describe('release workflow (M33-S01)', () => {
  it('runs on manual dispatch and on v* tags, never on a branch push', () => {
    expect(release).toMatch(/workflow_dispatch:/);
    expect(release).toMatch(/tags: \['v\*'\]/);
    expect(release).not.toMatch(/branches:/);
    expect(release).not.toMatch(/pull_request/);
  });

  it('may write packages and nothing else beyond reading the repo', () => {
    expect(release).toMatch(/packages: write/);
    expect(release).toMatch(/contents: read/);
    expect(release).not.toMatch(/contents: write/);
  });

  it('logs in to GHCR with the built in token', () => {
    expect(release).toMatch(/registry: ghcr\.io/);
    expect(release).toMatch(/secrets\.GITHUB_TOKEN/);
  });

  it.each([
    ['web', 'apps/web/Dockerfile'],
    ['worker', 'apps/worker/Dockerfile'],
    ['whisper', 'apps/whisper/Dockerfile'],
    ['tools', 'ops/Dockerfile.tools'],
  ])('builds the %s image from %s', (name, dockerfile) => {
    expect(release).toContain(`name: ${name}`);
    expect(release).toContain(dockerfile);
    expect(readFileSync(resolve(root, dockerfile), 'utf8')).toMatch(/^FROM /m);
  });

  it('builds the whisper image from its own folder, the other three from the repo root', () => {
    expect(release).toMatch(/context: apps\/whisper/);
    expect(release.match(/context: \./g)).toHaveLength(3);
  });

  it('tags every image with the full and the short sha, and builds linux/amd64 with buildx and the GitHub cache', () => {
    expect(release).toMatch(/github\.sha/);
    expect(release).toMatch(/short/);
    expect(release).toMatch(/platforms: linux\/amd64/);
    expect(release).toMatch(/docker\/setup-buildx-action/);
    expect(release).toMatch(/cache-from: type=gha/);
    expect(release).toMatch(/cache-to: type=gha/);
  });

  it('pushes under the lowercase repository name the compose file expects', () => {
    expect(release).toMatch(/IMAGE_PREFIX: ghcr\.io\/gabrielnig\/angels-delight-tv$/m);
    const compose = readFileSync(resolve(root, 'compose.prod.yaml'), 'utf8');
    expect(compose).toContain('ghcr.io/gabrielnig/angels-delight-tv');
  });

  it('scans each image with a pinned Trivy container and fails on fixable critical findings only', () => {
    expect(release).toMatch(/TRIVY_IMAGE: ghcr\.io\/aquasecurity\/trivy:0\.69\.3/);
    expect(release).not.toMatch(/aquasecurity\/trivy-action/);
    expect(release).toMatch(/--severity CRITICAL --ignore-unfixed --exit-code 1/);
  });

  it('scans before it pushes', () => {
    expect(release.indexOf('name: Trivy scan')).toBeGreaterThan(release.indexOf('load: true'));
    expect(release.indexOf('push: true')).toBeGreaterThan(release.indexOf('name: Trivy scan'));
  });
});
