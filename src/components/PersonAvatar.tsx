import { useState } from 'react';
import { Icon } from './Icon';
import { assigneeName } from '@/domain/assignees';
import { avatarUrl } from '@/domain/colors';
import { useStore } from '@/store/store';
import { useT } from '@/hooks/useT';

/** A real Todoist photo, with initials only when there is no usable photo. */
export function PersonAvatar({ id, decorative = false }: { id: string | null; decorative?: boolean }) {
  const { t } = useT();
  const snapshot = useStore((state) => state.snapshot);
  const [failed, setFailed] = useState<string | null>(null);
  const person = id === snapshot.user?.id ? snapshot.user : id ? snapshot.collaborators[id] : null;
  const name = id ? assigneeName(snapshot, id, t('assignee.unavailable')) : t('detail.unassigned');
  const source = avatarUrl(person, 'small');
  const initials = person ? name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase() : '?';
  const title = id ? `${t('detail.assignee')}: ${id === snapshot.user?.id ? `${t('assignee.me')} · ` : ''}${name}` : name;
  return <span className={`person-avatar${id ? '' : ' unassigned'}`} role={decorative ? undefined : 'img'}
    aria-hidden={decorative || undefined} aria-label={decorative ? undefined : title} title={decorative ? undefined : title}>
    {!id ? <Icon name="user" size="sm" /> : source && failed !== source
      ? <img src={source} alt="" onError={() => setFailed(source)} referrerPolicy="no-referrer" />
      : initials || '?'}
  </span>;
}
