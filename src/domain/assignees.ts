import type { Item, Snapshot } from './types';
import { assignees } from './sharing';

export const ME = '@me';
export const UNASSIGNED = '@unassigned';
export const PERSONAL_ASSIGNEES = [ME, UNASSIGNED];

/** null means everyone; an empty selection deliberately means no tasks. */
export function matchesAssignee(item: Pick<Item, 'responsible_uid'>, selection: string[] | null | undefined, snapshot: Snapshot): boolean {
  if (selection == null) return true;
  if (!item.responsible_uid) return selection.includes(UNASSIGNED);
  return selection.includes(item.responsible_uid)
    || (Boolean(snapshot.user) && item.responsible_uid === snapshot.user?.id && selection.includes(ME));
}

export function assigneeName(snapshot: Snapshot, id: string | null, unavailable?: string): string {
  if (!id) return '';
  if (id === snapshot.user?.id) return snapshot.user.full_name;
  return snapshot.collaborators[id]?.full_name || snapshot.collaborators[id]?.email || unavailable || id;
}

export function canAssign(snapshot: Snapshot, projectId: string, id: string | null): boolean {
  if (snapshot.projects[projectId]?.can_assign_tasks === false) return false;
  return id === null || assignees(snapshot, projectId).some((person) => person.id === id);
}

/** Derived data only: the server snapshot and parent relationships are untouched. */
export function assigneeItems(snapshot: Snapshot, selection: string[] | null | undefined): Record<string, Item> {
  return Object.fromEntries(Object.entries(snapshot.items).filter(([, item]) => matchesAssignee(item, selection, snapshot)));
}
