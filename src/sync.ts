import type { SupabaseClient } from '@supabase/supabase-js';
import type { PendingAction, SyncErrorInfo } from './types';
import { getQueuedActions, removeQueuedAction, bumpRetryCount } from './queue';

const MAX_RETRIES = 3;

/** Executes a single pending action against Supabase. Throws on failure. */
async function runAction(client: SupabaseClient, action: PendingAction): Promise<void> {
  const table = client.from(action.table);

  if (action.operation === 'insert') {
    const { error } = await table.insert(action.payload);
    if (error) throw error;
  } else if (action.operation === 'update') {
    let query = table.update(action.payload);
    for (const [key, value] of Object.entries(action.match ?? {})) {
      query = query.eq(key, value as never);
    }
    const { error } = await query;
    if (error) throw error;
  } else if (action.operation === 'remove') {
    let query = table.delete();
    for (const [key, value] of Object.entries(action.match ?? {})) {
      query = query.eq(key, value as never);
    }
    const { error } = await query;
    if (error) throw error;
  }
}

/**
 * Flushes every queued action for a table, in FIFO order.
 * Stops at the first action that still fails after MAX_RETRIES,
 * so later actions don't get applied out of order.
 */
export async function flushQueue(
  client: SupabaseClient,
  table: string,
  onError?: (info: SyncErrorInfo) => void
): Promise<{ synced: number }> {
  const queued = await getQueuedActions(table);
  let synced = 0;

  for (const action of queued) {
    try {
      await runAction(client, action);
      await removeQueuedAction(action.id);
      synced += 1;
    } catch (err) {
      if (action.retries + 1 >= MAX_RETRIES) {
        onError?.({
          action,
          message: err instanceof Error ? err.message : 'Unknown sync error',
        });
        // Give up on this one but keep it in the queue for manual inspection
        // rather than silently dropping the user's data.
      } else {
        await bumpRetryCount(action);
      }
      // Stop here: don't apply later actions out of order ahead of a failed one.
      break;
    }
  }

  return { synced };
}
