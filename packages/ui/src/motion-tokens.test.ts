import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');
const files = {
  components: read('./components.css'),
  admin: read('../../../apps/web/src/components/admin/admin.css'),
};

describe('spinner and shimmer durations are tokens (design review finding 6)', () => {
  it('defines --motion-spin and --motion-shimmer in tokens.css, the skill reference and the doc', () => {
    for (const path of [
      './tokens.css',
      '../../../.claude/skills/angels-delight-design-system/reference/tokens.css',
    ]) {
      const css = read(path);
      expect(css).toMatch(/--motion-spin:\s*700ms/);
      expect(css).toMatch(/--motion-shimmer:\s*1\.4s/);
    }
    const doc = read('../../../docs/DESIGN-SYSTEM.md');
    expect(doc).toContain('`--motion-spin`');
    expect(doc).toContain('`--motion-shimmer`');
  });

  it.each(Object.entries(files))('%s css has no literal animation duration', (_name, css) => {
    const literals = css
      .split('\n')
      .filter((line) => /animation:|adm-shimmer|adm-spin|adm-sweep|ad-spin|ad-shimmer/.test(line))
      .filter((line) => /\b\d+(\.\d+)?m?s\b/.test(line) && !/var\(--motion/.test(line));
    expect(literals).toEqual([]);
  });
});
