import { describe, expect, it } from 'vitest';
import { accessChoices, accessOf, defaultAccess, isAccessLevel } from './projectAccess';

const workspace = { id: 'w', name: 'Studio' };

describe('project access', () => {
  it('offers Team only inside a workspace', () => {
    expect(accessChoices(true)).toEqual(['restricted', 'team', 'public']);
    expect(accessChoices(false)).toEqual(['restricted', 'public']);
  });

  it("gives a new project the workspace's own default, or private when personal", () => {
    expect(defaultAccess(null)).toBe('restricted');
    expect(defaultAccess(workspace)).toBe('team');
    expect(defaultAccess({ ...workspace, properties: { default_access_level: 'restricted' } })).toBe('restricted');
  });

  it('reads the level from the project, and falls back for an old copy without it', () => {
    expect(accessOf({ access: { visibility: 'public' } }, workspace)).toBe('public');
    expect(accessOf({}, workspace)).toBe('team');
    expect(accessOf({ access: null }, null)).toBe('restricted');
    expect(accessOf(undefined, null)).toBe('restricted');
  });

  it('knows the three levels, and passes an unknown one through', () => {
    expect(isAccessLevel('team')).toBe(true);
    expect(isAccessLevel('organisation')).toBe(false);
    expect(accessOf({ access: { visibility: 'organisation' } }, workspace)).toBe('organisation');
  });
});
