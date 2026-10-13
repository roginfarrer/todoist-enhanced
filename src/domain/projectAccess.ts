import type { Project, Workspace } from './types';

/**
 * Who can reach a project: the "Access" choice of Todoist's project form.
 *
 * Checked on a real account (#194): a workspace project takes `restricted`
 * (only the people invited), `team` (everyone in the workspace) or `public`
 * (anyone with the link). A personal project takes `restricted` and `public`;
 * asking for `team` on one is accepted and ignored, so it is not offered.
 * Todoist refuses `public` on accounts where the feature is off.
 */
export const ACCESS_LEVELS = ['restricted', 'team', 'public'] as const;
export type AccessLevel = (typeof ACCESS_LEVELS)[number];

export function isAccessLevel(value: string): value is AccessLevel {
  return (ACCESS_LEVELS as readonly string[]).includes(value);
}

/** The levels a project can have where it lives. */
export function accessChoices(inWorkspace: boolean): AccessLevel[] {
  return inWorkspace ? ['restricted', 'team', 'public'] : ['restricted', 'public'];
}

/** What a new project gets when nothing is chosen: the workspace's own default, or private. */
export function defaultAccess(workspace: Workspace | null | undefined): string {
  if (!workspace) return 'restricted';
  return workspace.properties?.default_access_level || 'team';
}

/** The level a project has now. An old copy of the project without the field gets the default. */
export function accessOf(project: Pick<Project, 'access'> | undefined, workspace: Workspace | null | undefined): string {
  return project?.access?.visibility || defaultAccess(workspace);
}
