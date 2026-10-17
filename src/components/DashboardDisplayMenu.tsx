import { useEffect, useRef, useState } from 'react';
import { WorkspaceFilter } from './WorkspaceFilter';
import { AssigneeFilter } from './AssigneeFilter';
import { Icon } from './Icon';
import { useT } from '@/hooks/useT';
import { useStore } from '@/store/store';
import { viewPrefs } from '@/store/prefs';
import { defaultViewPrefs } from '@/domain/types';
import { PERSONAL_WORKSPACE } from '@/store/selectors';

/** Dashboard filters apply to both open tasks and completion statistics. */
export function DashboardDisplayMenu() {
  const { t } = useT();
  const prefs = useStore((state) => state.prefs);
  const snapshot = useStore((state) => state.snapshot);
  const filters = viewPrefs(prefs, 'dashboard').filters;
  const defaults = defaultViewPrefs('dashboard').filters;
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const workspaceChanged = filters.workspaces.length > 0 && ![PERSONAL_WORKSPACE, ...Object.keys(snapshot.workspaces)].every((id) => filters.workspaces.includes(id));
  const changed = Number(workspaceChanged) + Number(JSON.stringify(filters.assignees) !== JSON.stringify(defaults.assignees));
  useEffect(() => {
    if (!open) return;
    const outside = (event: MouseEvent) => {
      if (!ref.current?.contains(event.target as Node)) setOpen(false);
    };
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', outside);
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('mousedown', outside);
      document.removeEventListener('keydown', escape);
    };
  }, [open]);
  return <div className="displaywrap" ref={ref}>
    <button className="btn" aria-expanded={open} aria-haspopup="dialog" onClick={() => setOpen((value) => !value)}>
      <Icon name="sliders" size="sm" />{t('toolbar.display')}
      {changed > 0 && <span className="displaycount">{changed}</span>}
    </button>
    {open && <div className="popover displaypanel anchor-right" role="dialog" aria-label={t('toolbar.display')}>
      <div className="panelhead"><h5>{t('toolbar.display')}</h5>
        <button className="resetbtn" onClick={() => useStore.getState().setViewPrefs('dashboard', { filters: defaults })}>{t('toolbar.resetAll')}</button>
      </div>
      <WorkspaceFilter viewKey="dashboard" />
      <AssigneeFilter viewKey="dashboard" />
    </div>}
  </div>;
}
