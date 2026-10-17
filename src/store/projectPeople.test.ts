import { beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('@/api/projectPeople', () => ({ fetchProjectPeople: vi.fn() }));
vi.mock('./helpers', () => ({ schedulePersist: vi.fn() }));
import { fetchProjectPeople, type ProjectPeopleResponse } from '@/api/projectPeople';
import { createCollabSlice, clearProjectPeopleCache } from './collab';
import { emptySnapshot, type Project, type Snapshot } from '@/domain/types';
import { assignees } from '@/domain/sharing';
import type { AppState } from './types';
const fetch = vi.mocked(fetchProjectPeople);
const project = (id: string): Project => ({ id, name: id, color: 'red', parent_id: null, child_order: 0, is_archived: false, is_deleted: false, is_favorite: false });
function setup() {
  const snapshot: Snapshot = { ...emptySnapshot(), user: { id: 'me', full_name: 'Me' } as Snapshot['user'], projects: { p: project('p'), q: project('q') } };
  const state = { snapshot, connected: true, demo: false } as AppState;
  const set = (patch: unknown) => Object.assign(state, typeof patch === 'function' ? patch(state) : patch);
  const slice = createCollabSlice(set as never, () => state, {} as never);
  Object.assign(state, slice);
  return { state, slice };
}
const response = (): ProjectPeopleResponse => ({
  collaborators: [{ id: 'a', full_name: 'Alex', email: 'a@example.test', image_id: 'photo' }],
  collaborator_states: [{ project_id: 'p', user_id: 'a', state: 'active', role: 'READ_WRITE' }],
});
beforeEach(() => { vi.clearAllMocks(); clearProjectPeopleCache(); fetch.mockResolvedValue(response()); });

describe('project membership read-back', () => {
  it('restores the assignee field from authoritative project membership when sync omitted it', async () => {
    const { state, slice } = setup(); await slice.loadProjectPeople('p');
    expect(fetch).toHaveBeenCalledWith('p');
    expect(assignees(state.snapshot, 'p').map((person) => person.id)).toEqual(['me', 'a']);
    expect(state.snapshot.collaborators.a.image_id).toBe('photo');
  });
  it('deduplicates requests and caches a successful read briefly', async () => {
    const { slice } = setup(); await Promise.all([slice.loadProjectPeople('p'), slice.loadProjectPeople('p')]);
    await slice.loadProjectPeople('p'); expect(fetch).toHaveBeenCalledTimes(1);
    await slice.loadProjectPeople('p', true); expect(fetch).toHaveBeenCalledTimes(2);
  });
  it('retains other projects and existing photos when the project endpoint omits an image', async () => {
    const { state, slice } = setup();
    state.snapshot.collaborators.a = { id: 'a', full_name: 'Before', email: '', image_id: 'existing-photo' };
    state.snapshot.collaboratorStates = [{ project_id: 'q', user_id: 'a', state: 'active' }];
    fetch.mockResolvedValue({ collaborators: [{ id: 'a', full_name: 'After', email: '' } as Snapshot['collaborators'][string]], collaborator_states: response().collaborator_states });
    await slice.loadProjectPeople('p');
    expect(state.snapshot.collaborators.a.image_id).toBe('existing-photo');
    expect(state.snapshot.collaboratorStates).toHaveLength(2);
  });
  it('does not treat an invited or deleted member as eligible', async () => {
    const { state, slice } = setup();
    fetch.mockResolvedValue({ ...response(), collaborator_states: [
      { project_id: 'p', user_id: 'a', state: 'active', is_deleted: true },
      { project_id: 'p', user_id: 'pending', state: 'invited' },
    ] });
    await slice.loadProjectPeople('p'); expect(assignees(state.snapshot, 'p')).toEqual([]);
  });
  it('does not overwrite another account when the request finishes after a switch', async () => {
    const { state, slice } = setup(); let finish!: (value: ProjectPeopleResponse) => void;
    fetch.mockReturnValue(new Promise((resolve) => { finish = resolve; }));
    const loading = slice.loadProjectPeople('p');
    state.snapshot = { ...state.snapshot, user: { id: 'other', full_name: 'Other' } as Snapshot['user'] };
    finish(response()); await loading; expect(state.snapshot.collaborators).toEqual({});
  });
  it('keeps cached data on an error and retries a failed read', async () => {
    const { state, slice } = setup(); state.snapshot.collaboratorStates = response().collaborator_states;
    fetch.mockRejectedValueOnce(new Error('Offline')); await slice.loadProjectPeople('p');
    expect(state.snapshot.collaboratorStates).toEqual(response().collaborator_states);
    await slice.loadProjectPeople('p'); expect(fetch).toHaveBeenCalledTimes(2);
  });
  it('does not make real network requests from the built-in demo or for unknown projects', async () => {
    const { state, slice } = setup(); state.demo = true; await slice.loadProjectPeople('p');
    state.demo = false; await slice.loadProjectPeople('missing'); expect(fetch).not.toHaveBeenCalled();
  });
});
