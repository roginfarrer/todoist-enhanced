import { describe, expect, it } from 'vitest';
import { applySync, resolveTempIds } from './sync';
import { emptySnapshot, type Snapshot } from '@/domain/types';
import { item } from '@/test/items';

const section = (id: string, project_id: string) => ({
  id, project_id, name: id, section_order: 1, is_archived: false, is_deleted: false,
});

describe('resolveTempIds', () => {
  it('returns the snapshot untouched when nothing was mapped', () => {
    const snapshot = emptySnapshot();
    expect(resolveTempIds(snapshot, {})).toBe(snapshot);
  });

  it('renames a placeholder and points everything at the real id', () => {
    const snapshot: Snapshot = {
      ...emptySnapshot(),
      items: {
        'tmp-parent': item({ id: 'tmp-parent', project_id: 'p', section_id: 'tmp-section' }),
        'tmp-child': item({ id: 'tmp-child', parent_id: 'tmp-parent', project_id: 'p' }),
      },
      sections: { 'tmp-section': section('tmp-section', 'p') },
    };
    const next = resolveTempIds(snapshot, {
      'tmp-parent': 'real-parent', 'tmp-child': 'real-child', 'tmp-section': 'real-section',
    });
    expect(Object.keys(next.items).sort()).toEqual(['real-child', 'real-parent']);
    expect(next.items['real-child'].parent_id).toBe('real-parent');
    expect(next.items['real-parent'].section_id).toBe('real-section');
    expect(Object.keys(next.sections)).toEqual(['real-section']);
  });

  it('drops the placeholder when the real copy has already arrived', () => {
    const snapshot: Snapshot = {
      ...emptySnapshot(),
      items: {
        tmp: item({ id: 'tmp', content: 'placeholder' }),
        real: item({ id: 'real', content: 'from Todoist' }),
      },
    };
    const next = resolveTempIds(snapshot, { tmp: 'real' });
    expect(Object.keys(next.items)).toEqual(['real']);
    expect(next.items.real.content).toBe('from Todoist');
  });
});

describe('applySync filters', () => {
  const filter = (id: string, extra = {}) => ({
    id, name: id, query: 'today', color: 'red', item_order: 1, is_deleted: false, is_favorite: false, ...extra,
  });

  it('reads filters into a snapshot saved before they existed', () => {
    const old = { ...emptySnapshot() };
    delete old.filters;
    const next = applySync(old, { sync_token: 't', full_sync: true, filters: [filter('f1')] });
    expect(Object.keys(next.filters ?? {})).toEqual(['f1']);
  });

  it('keeps filters when an incremental read carries none, and drops a deleted one', () => {
    const base = applySync(emptySnapshot(), { sync_token: 't', full_sync: true, filters: [filter('f1'), filter('f2')] });
    const same = applySync(base, { sync_token: 'u', full_sync: false });
    expect(Object.keys(same.filters ?? {}).sort()).toEqual(['f1', 'f2']);
    const gone = applySync(base, { sync_token: 'v', full_sync: false, filters: [filter('f2', { is_deleted: true })] });
    expect(Object.keys(gone.filters ?? {})).toEqual(['f1']);
  });
});

describe('collaborator sync variants and deletion', () => {
  it('reads both spellings of the membership field defensively', () => {
    const next = applySync(emptySnapshot(), { sync_token: 't', full_sync: true,
      collaborators_states: [{ project_id: 'p', user_id: 'a', state: 'active' }] });
    expect(next.collaboratorStates?.[0].user_id).toBe('a');
  });
  it('removes a collaborator mapping marked deleted instead of keeping an active tombstone', () => {
    const base = { ...emptySnapshot(), collaboratorStates: [{ project_id: 'p', user_id: 'a', state: 'active' }] };
    const next = applySync(base, { sync_token: 't', full_sync: false,
      collaborator_states: [{ project_id: 'p', user_id: 'a', state: 'active', is_deleted: true }] });
    expect(next.collaboratorStates).toEqual([]);
  });
});
