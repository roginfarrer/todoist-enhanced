import { useEffect, useState } from 'react';
import { subYears } from 'date-fns';
import { fetchCompleted } from '@/api/completed';
import { itemFromCompleted } from '@/api/tasks';
import { useStore } from '@/store/store';
import type { Item } from '@/domain/types';

const NONE: Item[] = [];

/**
 * The tasks a project has completed, for "Show completed tasks" (#229).
 *
 * The sync only carries open tasks, so what the snapshot holds of a project's
 * completed work is whatever was ticked on this device since it last synced:
 * a project page that read only that showed none of its history. The history
 * is asked for here instead, a year back, for the project on screen, and only
 * while the option is on.
 *
 * What comes back is for the project it was asked about: switching project
 * never hands the last one's tasks to the next.
 */
export function useProjectCompleted(projectId: string, enabled: boolean): Item[] {
  const connected = useStore((s) => s.connected);
  const demo = useStore((s) => s.demo);
  const [loaded, setLoaded] = useState<{ projectId: string; items: Item[] } | null>(null);

  useEffect(() => {
    if (!enabled || !connected || demo) return;
    const controller = new AbortController();
    const until = new Date();
    fetchCompleted(subYears(until, 1), until, controller.signal, { project_id: projectId })
      .then((entries) => {
        if (controller.signal.aborted) return;
        /* A subtask is shown under its parent, never as a task of its own. */
        const roots = entries.filter((entry) => !(entry as { parent_id?: string | null }).parent_id);
        setLoaded({ projectId, items: roots.map(itemFromCompleted) });
      })
      .catch(() => undefined);
    return () => controller.abort();
  }, [projectId, enabled, connected, demo]);

  return enabled && loaded?.projectId === projectId ? loaded.items : NONE;
}
