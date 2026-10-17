import { describe, expect, it } from 'vitest';
import { emptySnapshot, defaultViewPrefs } from './types';
import { item, due } from '@/test/items';
import { ME, UNASSIGNED, PERSONAL_ASSIGNEES, matchesAssignee, assigneeItems, canAssign } from './assignees';
import { childIndex, makeChildrenOf, openItems, rootItems, datedRoots, applyFilters, groupItems, sortItems } from '@/store/selectors';
import { defaultPreferences, viewPrefs } from '@/store/prefs';
import { effectiveEstimate } from './estimates';

function fixture() {
  const snapshot = emptySnapshot();
  snapshot.user = { id: 'me', full_name: 'Me' } as typeof snapshot.user;
  snapshot.collaborators = {
    a: { id: 'a', full_name: 'Alice', email: '', image_id: null },
    b: { id: 'b', full_name: 'Bob', email: '', image_id: null },
  };
  snapshot.collaboratorStates = [
    { project_id: 'p', user_id: 'a', state: 'active' },
    { project_id: 'p', user_id: 'b', state: 'invited' },
  ];
  snapshot.items = Object.fromEntries([
    item({ id: 'mine', responsible_uid: 'me' }), item({ id: 'none', responsible_uid: null }),
    item({ id: 'alice', responsible_uid: 'a' }), item({ id: 'bob', responsible_uid: 'b' }),
    item({ id: 'unknown', responsible_uid: 'missing' }),
  ].map((task) => [task.id, task]));
  return snapshot;
}

describe('assignee scope (#203)', () => {
  it.each(['today', 'week', 'upcoming', 'someday', 'review', 'matrix', 'inbox', 'label:work', 'dashboard'])('defaults %s to me and unassigned', (key) => {
    const snapshot = fixture();
    expect(defaultViewPrefs(key).filters.assignees).toEqual(PERSONAL_ASSIGNEES);
    expect(Object.keys(assigneeItems(snapshot, defaultViewPrefs(key).filters.assignees))).toEqual(['mine', 'none']);
  });
  it.each(['project:p', 'filter:f'])('keeps everyone in %s', (key) => {
    expect(Object.keys(assigneeItems(fixture(), defaultViewPrefs(key).filters.assignees))).toHaveLength(5);
  });
  it('distinguishes everyone, nobody, unassigned, me, named people and combined selections', () => {
    const snapshot = fixture();
    expect(Object.keys(assigneeItems(snapshot, null))).toHaveLength(5);
    expect(Object.keys(assigneeItems(snapshot, []))).toEqual([]);
    expect(Object.keys(assigneeItems(snapshot, [ME]))).toEqual(['mine']);
    expect(Object.keys(assigneeItems(snapshot, [UNASSIGNED]))).toEqual(['none']);
    expect(Object.keys(assigneeItems(snapshot, ['a', 'b']))).toEqual(['alice', 'bob']);
    expect(matchesAssignee(snapshot.items.unknown, [UNASSIGNED], snapshot)).toBe(false);
  });
  it('does not identify another assignee as me while current-user data is unavailable', () => {
    const snapshot = fixture(); snapshot.user = null;
    expect(Object.keys(assigneeItems(snapshot, PERSONAL_ASSIGNEES))).toEqual(['none']);
  });
  it('migrates old saved display preferences without overwriting other filters', () => {
    const prefs = defaultPreferences('en');
    const old = defaultViewPrefs(); delete old.filters.assignees; old.filters.labels = ['work'];
    prefs.views.today = old; prefs.views['project:p'] = old;
    expect(viewPrefs(prefs, 'today').filters).toMatchObject({ assignees: PERSONAL_ASSIGNEES, labels: ['work'] });
    expect(viewPrefs(prefs, 'project:p').filters.assignees).toBeNull();
  });
  it('keeps explicit everyone/nobody overrides when migrating', () => {
    const prefs = defaultPreferences('en');
    prefs.views.today = { ...defaultViewPrefs('today'), filters: { ...defaultViewPrefs('today').filters, assignees: null } };
    expect(viewPrefs(prefs, 'today').filters.assignees).toBeNull();
    const changed = { ...prefs, views: { ...prefs.views, today: { ...prefs.views.today, filters: { ...prefs.views.today.filters, assignees: [] } } } };
    expect(viewPrefs(changed, 'today').filters.assignees).toEqual([]);
  });
  it('promotes my child when its parent belongs to somebody else, including on the same date', () => {
    const snapshot = fixture();
    snapshot.items = {
      parent: item({ id: 'parent', responsible_uid: 'a', due: due('2026-10-13') }),
      child: item({ id: 'child', parent_id: 'parent', responsible_uid: 'me', due: due('2026-10-13') }),
      undated: item({ id: 'undated', parent_id: 'parent', responsible_uid: null }),
    };
    const filtered = { ...snapshot, items: assigneeItems(snapshot, PERSONAL_ASSIGNEES) };
    const open = openItems(filtered);
    expect(rootItems(open).map((task) => task.id)).toEqual(['child', 'undated']);
    expect(datedRoots(open, snapshot).map((task) => task.id)).toEqual(['child', 'undated']);
    expect(snapshot.items.child.parent_id).toBe('parent');
  });
  it('excludes colleagues children from derived estimates and nested rows', () => {
    const snapshot = fixture();
    snapshot.items = {
      parent: item({ id: 'parent', responsible_uid: 'me' }),
      mine: item({ id: 'mine', parent_id: 'parent', responsible_uid: 'me', labels: ['est-10'] }),
      theirs: item({ id: 'theirs', parent_id: 'parent', responsible_uid: 'a', labels: ['est-90'] }),
    };
    const scoped = { ...snapshot, items: assigneeItems(snapshot, PERSONAL_ASSIGNEES) };
    const children = makeChildrenOf(childIndex(scoped));
    expect(children('parent').map((task) => task.id)).toEqual(['mine']);
    expect(effectiveEstimate(snapshot.items.parent, children).minutes).toBe(10);
    expect(effectiveEstimate(snapshot.items.parent, makeChildrenOf(childIndex(snapshot))).minutes).toBe(100);
  });
  it('intersects assignees with existing workspace/tag/priority filters', () => {
    const snapshot = fixture(); const filters = defaultViewPrefs('today').filters;
    filters.labels = ['work']; snapshot.items.mine.labels = ['work']; snapshot.items.alice.labels = ['work'];
    expect(applyFilters(openItems(snapshot), filters, snapshot, () => []).map((task) => task.id)).toEqual(['mine']);
  });
  it('sorts and groups by people with a stable unassigned group at the end', () => {
    const snapshot = fixture(); const tasks = [snapshot.items.none, snapshot.items.bob, snapshot.items.alice];
    expect(sortItems(tasks, 'assignee', () => [], 'project', snapshot).map((task) => task.id)).toEqual(['alice', 'bob', 'none']);
    const labels = { none: '', noProject: '', noSection: '', noEstimate: '', noLabel: '', priority: () => '', day: () => '', scheduled: '', available: '', unassigned: 'Unassigned' };
    expect(groupItems(tasks, 'assignee', snapshot, labels).map((group) => [group.key, group.title])).toEqual([['a', 'Alice'], ['b', 'Bob'], ['none', 'Unassigned']]);
  });
  it('allows only eligible active collaborators, with no cross-project assignment', () => {
    const snapshot = fixture();
    expect(canAssign(snapshot, 'p', 'a')).toBe(true);
    expect(canAssign(snapshot, 'p', 'me')).toBe(true);
    expect(canAssign(snapshot, 'p', 'b')).toBe(false);
    expect(canAssign(snapshot, 'other', 'a')).toBe(false);
    expect(canAssign(snapshot, 'other', null)).toBe(true);
  });
});

describe('assignment permissions', () => {
  it('respects an explicit project permission denial even for unassignment', () => {
    const snapshot = emptySnapshot();
    snapshot.projects.p = { id: 'p', name: 'p', color: 'red', parent_id: null, child_order: 0, is_archived: false, is_deleted: false, is_favorite: false, can_assign_tasks: false };
    expect(canAssign(snapshot, 'p', null)).toBe(false);
    expect(canAssign(snapshot, 'p', 'other')).toBe(false);
  });
});
