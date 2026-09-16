import { useCallback, useEffect, useRef, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { SyncErrorInfo, UseOfflineRangerResult } from './types';
import { enqueueAction, readCache, writeCache, countQueuedActions } from './queue';
import { flushQueue } from './sync';

function isBrowserOnline(): boolean {
  return typeof navigator === 'undefined' ? true : navigator.onLine;
}

/**
 * React hook that makes a Supabase table usable offline.
 * Reads are served from a local cache; writes are queued while
 * offline and flushed automatically once the connection returns.
 */
export function useOfflineRanger<T extends Record<string, unknown>>(
  client: SupabaseClient,
  table: string
): UseOfflineRangerResult<T> {
  const [data, setData] = useState<T[]>([]);
  const [isOnline, setIsOnline] = useState<boolean>(isBrowserOnline());
  const [pendingCount, setPendingCount] = useState(0);
  const [syncError, setSyncError] = useState<SyncErrorInfo | null>(null);
  const clientRef = useRef(client);
  clientRef.current = client;

  const refreshPendingCount = useCallback(async () => {
    setPendingCount(await countQueuedActions(table));
  }, [table]);

  const refresh = useCallback(async () => {
    if (isBrowserOnline()) {
      const { data: rows, error } = await clientRef.current.from(table).select('*');
      if (!error && rows) {
        setData(rows as T[]);
        await writeCache(table, rows);
        return;
      }
    }
    // Offline, or the network request failed: fall back to the last known cache.
    setData(await readCache<T>(table));
  }, [table]);

  const sync = useCallback(async () => {
    const { synced } = await flushQueue(clientRef.current, table, (info) => setSyncError(info));
    if (synced > 0) {
      setSyncError(null);
      await refresh();
    }
    await refreshPendingCount();
  }, [table, refresh, refreshPendingCount]);

  useEffect(() => {
    refresh();
    refreshPendingCount();

    const handleOnline = () => {
      setIsOnline(true);
      sync();
    };
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [table]);

  const insert = useCallback(
    async (payload: T) => {
      // Optimistic update: show the row immediately regardless of network state.
      setData((prev) => [...prev, payload]);

      if (isBrowserOnline()) {
        const { error } = await clientRef.current.from(table).insert(payload);
        if (!error) return refresh();
      }
      await enqueueAction({ table, operation: 'insert', payload });
      await refreshPendingCount();
    },
    [table, refresh, refreshPendingCount]
  );

  const update = useCallback(
    async (match: Record<string, unknown>, payload: Partial<T>) => {
      setData((prev) =>
        prev.map((row) =>
          Object.entries(match).every(([k, v]) => row[k] === v) ? { ...row, ...payload } : row
        )
      );

      if (isBrowserOnline()) {
        let query = clientRef.current.from(table).update(payload as never);
        for (const [key, value] of Object.entries(match)) {
          query = query.eq(key, value as never);
        }
        const { error } = await query;
        if (!error) return refresh();
      }
      await enqueueAction({ table, operation: 'update', payload: payload as Record<string, unknown>, match });
      await refreshPendingCount();
    },
    [table, refresh, refreshPendingCount]
  );

  const remove = useCallback(
    async (match: Record<string, unknown>) => {
      setData((prev) => prev.filter((row) => !Object.entries(match).every(([k, v]) => row[k] === v)));

      if (isBrowserOnline()) {
        let query = clientRef.current.from(table).delete();
        for (const [key, value] of Object.entries(match)) {
          query = query.eq(key, value as never);
        }
        const { error } = await query;
        if (!error) return refresh();
      }
      await enqueueAction({ table, operation: 'remove', payload: {}, match });
      await refreshPendingCount();
    },
    [table, refresh, refreshPendingCount]
  );

  return { data, isOnline, pendingCount, syncError, insert, update, remove, refresh };
}
