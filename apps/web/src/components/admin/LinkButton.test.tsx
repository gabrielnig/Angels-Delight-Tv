// @vitest-environment jsdom
import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

const seen: Array<Record<string, unknown>> = [];
vi.mock('next/link', () => ({
  default: (props: Record<string, unknown> & { children?: unknown }) => {
    seen.push(props);
    return <a href={String(props.href)}>{props.children as never}</a>;
  },
}));

import { LinkButton } from './Button';

describe('LinkButton prefetch', () => {
  it('never prefetches a download, which would run the export for every visit', () => {
    seen.length = 0;
    render(
      <LinkButton href="/admin/audit-log/export" icon="download">
        Export CSV
      </LinkButton>,
    );
    expect(seen[0]!.prefetch).toBe(false);
  });

  it('leaves normal links to the framework default', () => {
    seen.length = 0;
    render(<LinkButton href="/admin/videos">Videos</LinkButton>);
    expect(seen[0]!.prefetch).toBeUndefined();
  });
});
