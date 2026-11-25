import { describe, expect, it } from 'vitest';
import { whoCanDo } from './help-who';

describe('whoCanDo', () => {
  it('lists each action with its plain name and the lowest role, from the permission table', () => {
    expect(whoCanDo(['video.upload', 'video.delete'])).toEqual([
      {
        action: 'video.upload',
        label: 'Upload videos',
        role: 'editor',
        roleLabel: 'Editor and above',
      },
      {
        action: 'video.delete',
        label: 'Move videos to Trash',
        role: 'admin',
        roleLabel: 'Admin and above',
      },
    ]);
  });
  it('says Super admin only for the top role and skips unknown ids', () => {
    expect(whoCanDo(['settings.flags'])[0]?.roleLabel).toBe('Super admin only');
    expect(whoCanDo(['nope.nothing'])).toEqual([]);
  });
});
