export type Operation = 'insert' | 'update' | 'remove';

/**
 * A single pending write, waiting to be sent to Supabase
 * once the connection comes back.
 */
export interface PendingAction<T = Record<string, unknown>> {
  id: string; // local uuid, generated at enqueue time
  table: string;
  operation: Operation;
  payload: T;
  // for update/remove: which row to target (usually a primary key match)
  match?: Record<string, unknown>;
  createdAt: number;
  retries: number;
}

export interface SyncErrorInfo {
  action: PendingAction;
  message: string;
}

export interface UseOfflineRangerResult<T> {
  data: T[];
  isOnline: boolean;
  pendingCount: number;
  syncError: SyncErrorInfo | null;
  insert: (payload: T) => Promise<void>;
  update: (match: Record<string, unknown>, payload: Partial<T>) => Promise<void>;
  remove: (match: Record<string, unknown>) => Promise<void>;
  refresh: () => Promise<void>;
}
