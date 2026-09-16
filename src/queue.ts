import { openDB, type IDBPDatabase } from 'idb';
import type { PendingAction } from './types';

const DB_NAME = 'offline-ranger';
const DB_VERSION = 1;
const STORE_QUEUE = 'pending-actions';
const STORE_CACHE = 'table-cache';

let dbPromise: Promise<IDBPDatabase> | null = null;

function getDb(): Promise<IDBPDatabase> {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE_QUEUE)) {
          db.createObjectStore(STORE_QUEUE, { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains(STORE_CACHE)) {
          db.createObjectStore(STORE_CACHE, { keyPath: 'table' });
        }
      },
    });
  }
  return dbPromise;
}

function makeId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export async function enqueueAction(
  action: Omit<PendingAction, 'id' | 'createdAt' | 'retries'>
): Promise<PendingAction> {
  const db = await getDb();
  const full: PendingAction = {
    ...action,
    id: makeId(),
    createdAt: Date.now(),
    retries: 0,
  };
  await db.put(STORE_QUEUE, full);
  return full;
}

export async function getQueuedActions(table: string): Promise<PendingAction[]> {
  const db = await getDb();
  const all = (await db.getAll(STORE_QUEUE)) as PendingAction[];
  return all
    .filter((a) => a.table === table)
    .sort((a, b) => a.createdAt - b.createdAt); // FIFO
}

export async function removeQueuedAction(id: string): Promise<void> {
  const db = await getDb();
  await db.delete(STORE_QUEUE, id);
}

export async function bumpRetryCount(action: PendingAction): Promise<void> {
  const db = await getDb();
  await db.put(STORE_QUEUE, { ...action, retries: action.retries + 1 });
}

export async function countQueuedActions(table: string): Promise<number> {
  const actions = await getQueuedActions(table);
  return actions.length;
}

// --- Local cache of the last known rows, so the UI has something
// to render immediately while offline or before the first sync. ---

export async function readCache<T>(table: string): Promise<T[]> {
  const db = await getDb();
  const entry = await db.get(STORE_CACHE, table);
  return entry?.rows ?? [];
}

export async function writeCache<T>(table: string, rows: T[]): Promise<void> {
  const db = await getDb();
  await db.put(STORE_CACHE, { table, rows });
}
