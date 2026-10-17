import { useCallback, useEffect } from 'react';
import { useStore } from '@/store/store';

/** Revalidate a project's people on entry and when returning to the tab. */
export function useProjectPeople(projectId?: string, automatic = true) {
  const load = useStore((state) => state.loadProjectPeople);
  const connected = useStore((state) => state.connected);
  const demo = useStore((state) => state.demo);
  const memberships = useStore((state) => (state.snapshot.collaboratorStates ?? []).filter((person) => person.project_id === projectId && !person.is_deleted).length);
  const warm = useCallback(async () => {
    if (projectId && connected && !demo) await load(projectId);
  }, [projectId, connected, demo, load]);
  useEffect(() => {
    if (!automatic) return;
    void memberships;
    void warm();
    const refresh = () => { if (document.visibilityState === 'visible') void warm(); };
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, [warm, automatic, memberships]);
  return warm;
}
