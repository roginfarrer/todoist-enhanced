import { PersonAvatar } from './PersonAvatar';

export function AssigneeBadge({ id }: { id: string | null }) {
  return id ? <span className="assignee-badge"><PersonAvatar id={id} /></span> : null;
}
