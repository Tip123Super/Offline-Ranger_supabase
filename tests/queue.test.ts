import { describe, it, expect, beforeEach } from 'vitest';
import 'fake-indexeddb/auto';
import { enqueueAction, getQueuedActions, removeQueuedAction, countQueuedActions } from '../src/queue';

describe('offline queue', () => {
  it('enqueues an action and retrieves it in FIFO order', async () => {
    const first = await enqueueAction({ table: 'expenses', operation: 'insert', payload: { amount: 10 } });
    const second = await enqueueAction({ table: 'expenses', operation: 'insert', payload: { amount: 20 } });

    const queued = await getQueuedActions('expenses');

    expect(queued.map((a) => a.id)).toEqual([first.id, second.id]);
  });

  it('removes an action from the queue once synced', async () => {
    const action = await enqueueAction({ table: 'categories', operation: 'insert', payload: { name: 'food' } });
    await removeQueuedAction(action.id);

    const remaining = await getQueuedActions('categories');
    expect(remaining).toHaveLength(0);
  });

  it('counts only the actions for the requested table', async () => {
    await enqueueAction({ table: 'notes', operation: 'insert', payload: { text: 'a' } });
    await enqueueAction({ table: 'notes', operation: 'insert', payload: { text: 'b' } });
    await enqueueAction({ table: 'other-table', operation: 'insert', payload: { text: 'c' } });

    expect(await countQueuedActions('notes')).toBe(2);
  });
});
