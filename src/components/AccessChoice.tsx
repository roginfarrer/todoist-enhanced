import { useState } from 'react';
import { Icon } from './Icon';
import { useT } from '@/hooks/useT';
import { isAccessLevel } from '@/domain/projectAccess';
import type { TranslationKey } from '@/i18n';
import type { Workspace } from '@/domain/types';

interface AccessChoiceProps {
  levels: string[];
  value: string;
  onChange: (level: string) => void;
  /** Its logo stands for "Team", as it does in Todoist. */
  workspace: Workspace | null;
  labelledBy: string;
}

/**
 * Who can reach a project, as a row of tall tiles: an icon, a title and what
 * it means (#194). A lock is Restricted, the workspace's own picture is Team
 * and a globe is Public, the marks Todoist uses. A value this app does not
 * know has no icon and no sentence, only its name.
 */
export function AccessChoice({ levels, value, onChange, workspace, labelledBy }: AccessChoiceProps) {
  const { t } = useT();
  return (
    <div className="accesschoice" role="radiogroup" aria-labelledby={labelledBy} style={{ '--n': levels.length } as React.CSSProperties}>
      {levels.map((level) => {
        const known = isAccessLevel(level);
        return (
          <button
            key={level}
            type="button"
            role="radio"
            className="accesstile"
            aria-checked={value === level}
            aria-labelledby={`access-${level}-title`}
            aria-describedby={known ? `access-${level}-hint` : undefined}
            onClick={() => onChange(level)}
          >
            <span className="accessmark" aria-hidden="true">
              {level === 'restricted' && <Icon name="lock" />}
              {level === 'public' && <Icon name="globe" />}
              {level === 'team' && <WorkspaceMark workspace={workspace} />}
              {!known && <Icon name="eye" />}
            </span>
            <strong id={`access-${level}-title`}>{known ? t(`access.${level}` as TranslationKey) : level}</strong>
            {known && <span id={`access-${level}-hint`}>{t(`access.${level}.hint` as TranslationKey)}</span>}
          </button>
        );
      })}
    </div>
  );
}

/** The workspace's picture, or a group glyph when it has none or it does not load. */
function WorkspaceMark({ workspace }: { workspace: Workspace | null }) {
  const [broken, setBroken] = useState<string | null>(null);
  const logo = workspace?.logo_big ?? null;
  if (!logo || broken === logo) return <Icon name="group" />;
  return <img src={logo} alt="" referrerPolicy="no-referrer" onError={() => setBroken(logo)} />;
}
