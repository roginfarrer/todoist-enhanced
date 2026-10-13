import { Icon } from './Icon';
import { useT } from '@/hooks/useT';

/**
 * The star on a filter or tag card: always there, filled when it is a
 * favourite, one click to change it (#217). It used to be a mark you could
 * read but not press, and the change lived in the three-dot menu.
 */
export function FavouriteStar({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  const { t } = useT();
  return (
    <button
      type="button"
      className={`tagcard-star${on ? ' on' : ''}`}
      aria-pressed={on}
      aria-label={t(on ? 'labels.unfavourite' : 'labels.favourite')}
      title={t(on ? 'labels.unfavourite' : 'labels.favourite')}
      onClick={onToggle}
    >
      <Icon name="star" size="sm" />
    </button>
  );
}
