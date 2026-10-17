import { fetchProjectPeople } from '@/api/projectPeople';
import { schedulePersist } from './helpers';
import { canAssign } from '@/domain/assignees';
/** Todoist's notifications, sharing a project, and assigning a task. */
import { command } from '@/api/commands';
import { translate } from '@/i18n';
import type { Snapshot } from '@/domain/types';
import type { Slice, CollabSlice } from './types';

const peopleRequests = new Map<string, { loadedAt: number; pending?: Promise<void> }>();
export const clearProjectPeopleCache = () => peopleRequests.clear();

/** Marks notifications read or unread in the snapshot. */
const mark = (snapshot: Snapshot, ids: string[], unread: boolean): Snapshot => {
  const next = { ...(snapshot.notifications ?? {}) };
  for (const id of ids) if (next[id]) next[id] = { ...next[id], is_unread: unread };
  return { ...snapshot, notifications: next };
};

export const createCollabSlice: Slice<CollabSlice> = (set, get) => ({
  async loadProjectPeople(projectId, force = false) {
    const owner = get().snapshot.user?.id;
    if (!owner || !get().connected || get().demo || !get().snapshot.projects[projectId]) return;
    const key = `${owner}:${projectId}`;
    const cached = peopleRequests.get(key);
    if (cached?.pending) return cached.pending;
    if (!force && cached && Date.now() - cached.loadedAt < 30_000) return;
    const entry: { loadedAt: number; pending?: Promise<void> } = { loadedAt: 0 };
    peopleRequests.set(key, entry);
    entry.pending = (async () => {
      try {
        const response = await fetchProjectPeople(projectId);
        if (get().demo || get().snapshot.user?.id !== owner || !get().snapshot.projects[projectId]) return;
        const states = response.collaborator_states ?? response.collaborators_states;
        set((state) => {
          const snapshot = state.snapshot;
          const collaborators = { ...snapshot.collaborators };
          for (const person of response.collaborators ?? []) {
            collaborators[person.id] = { ...collaborators[person.id], ...person };
          }
          return { snapshot: {
            ...snapshot, collaborators,
            collaboratorStates: states === undefined ? snapshot.collaboratorStates : [
              ...(snapshot.collaboratorStates ?? []).filter((person) => person.project_id !== projectId),
              ...states.filter((person) => person.project_id === projectId && !person.is_deleted),
            ],
            projects: response.project ? { ...snapshot.projects, [projectId]: { ...snapshot.projects[projectId], ...response.project, id: projectId } } : snapshot.projects,
          } };
        });
        entry.loadedAt = Date.now();
        schedulePersist(get().snapshot);
      } catch {
        // Preserve the last known membership offline or on a permission error.
      } finally { delete entry.pending; }
    })();
    return entry.pending;
  },
  async markNotifications(ids, unread = false) {
    const all = Object.values(get().snapshot.notifications ?? {}).filter((n) => !n.is_deleted);
    const targets = ids === 'all' ? all.filter((n) => n.is_unread !== false).map((n) => n.id) : ids;
    if (targets.length === 0) return;
    const commands = ids === 'all' && !unread
      ? [command('live_notifications_mark_read_all', {})]
      : [command(unread ? 'live_notifications_mark_unread' : 'live_notifications_mark_read', { ids: targets })];
    await get().apply(commands, (snapshot) => mark(snapshot, targets, unread));
  },

  async answerInvitation(notificationId, accept) {
    const note = get().snapshot.notifications?.[notificationId];
    if (!note?.invitation_id || !note.invitation_secret) return;
    await get().apply(
      [command(accept ? 'accept_invitation' : 'reject_invitation', {
        invitation_id: note.invitation_id, invitation_secret: note.invitation_secret,
      })],
      /* Answered at once on screen: the buttons give way to the answer,
         which is also the `state` Todoist then keeps on the notification.
         A refusal puts the buttons back (revertRefused) with its toast. */
      (snapshot) => {
        const read = mark(snapshot, [notificationId], false);
        const current = read.notifications?.[notificationId];
        if (!current) return read;
        return {
          ...read,
          notifications: { ...read.notifications, [notificationId]: { ...current, state: accept ? 'accepted' : 'rejected' } },
        };
      },
    );
  },

  async shareProject(projectId, email, role) {
    await get().apply(
      [command('share_project', { project_id: projectId, email, ...(role ? { role } : {}) })],
      (snapshot) => snapshot,
    );
    await get().loadProjectPeople(projectId, true);
  },

  async changeRole(projectId, userId, role) {
    await get().apply(
      [command('project_change_role', { id: projectId, user_id: userId, role })],
      (snapshot) => snapshot,
    );
    await get().loadProjectPeople(projectId, true);
  },

  async removeCollaborator(projectId, email) {
    await get().apply(
      [command('delete_collaborator', { project_id: projectId, email })],
      (snapshot) => snapshot,
    );
    await get().loadProjectPeople(projectId, true);
  },

  async leaveProject(projectId) {
    const { snapshot, prefs } = get();
    const project = snapshot.projects[projectId];
    const email = snapshot.user?.email;
    if (!project || !email) return;
    await get().apply(
      [command('delete_collaborator', { project_id: projectId, email })],
      (current) => {
        const projects = { ...current.projects };
        const sections = { ...current.sections };
        const items = { ...current.items };
        delete projects[projectId];
        for (const section of Object.values(sections)) if (section.project_id === projectId) delete sections[section.id];
        for (const item of Object.values(items)) if (item.project_id === projectId) delete items[item.id];
        return { ...current, projects, sections, items };
      },
    );
    get().toast(translate(prefs.locale, 'project.left', { name: project.name }));
  },

  async assignTask(itemId, userId) {
    const item = get().snapshot.items[itemId];
    if (!item || item.responsible_uid === userId) return;
    if (!canAssign(get().snapshot, item.project_id, userId)) {
      get().toast(translate(get().prefs.locale, 'assignee.invalid'));
      return;
    }
    await get().apply(
      [command('item_update', { id: itemId, responsible_uid: userId })],
      (snapshot) => {
        const item = snapshot.items[itemId];
        return item
          ? { ...snapshot, items: { ...snapshot.items, [itemId]: { ...item, responsible_uid: userId } } }
          : snapshot;
      },
    );
  },
});
