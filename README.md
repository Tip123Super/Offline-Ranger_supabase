# Offline Ranger

A tiny React hook that keeps your [Supabase](https://supabase.com)-backed app usable when the network isn't. It queues writes locally while you're offline and syncs them automatically the moment the connection comes back — no server changes, no extra infrastructure.

Supabase doesn't ship offline support out of the box (unlike Firebase). Offline Ranger fills that specific gap for React apps, especially PWAs.

## Why

Most Supabase + React apps just... break when the network drops. A write fails silently, the user loses their change, or the UI freezes waiting for a request that will never resolve. Offline Ranger wraps your Supabase calls so that:

- Reads fall back to a local cache when there's no connection.
- Writes are queued in IndexedDB instead of failing.
- The queue flushes automatically, in order, as soon as the browser goes back online.
- You get simple state (`isOnline`, `pendingCount`, `syncError`) to reflect all of this in your UI.

## Install

```bash
npm install offline-ranger
```

Peer dependencies: `react` (17+) and `@supabase/supabase-js` (2+).

## Usage

```tsx
import { createClient } from '@supabase/supabase-js';
import { useOfflineRanger } from 'offline-ranger';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

function TodoList() {
  const { data, isOnline, pendingCount, insert, update, remove } =
    useOfflineRanger(supabase, 'todos');

  return (
    <div>
      <p>{isOnline ? 'Online' : `Offline — ${pendingCount} change(s) pending`}</p>

      <button onClick={() => insert({ id: crypto.randomUUID(), title: 'New task', done: false })}>
        Add task
      </button>

      {data.map((todo) => (
        <div key={todo.id}>
          <input
            type="checkbox"
            checked={todo.done}
            onChange={(e) => update({ id: todo.id }, { done: e.target.checked })}
          />
          {todo.title}
          <button onClick={() => remove({ id: todo.id })}>Delete</button>
        </div>
      ))}
    </div>
  );
}
```

That's it — `insert`, `update`, and `remove` behave the same whether the user is online or not. See [`examples/basic-usage`](./examples/basic-usage) for a complete, runnable demo.

## API

`useOfflineRanger<T>(client: SupabaseClient, table: string)` returns:

| Field | Type | Description |
|---|---|---|
| `data` | `T[]` | Current rows, from Supabase when online, from cache when offline |
| `isOnline` | `boolean` | Live network status |
| `pendingCount` | `number` | Number of writes waiting to sync |
| `syncError` | `SyncErrorInfo \| null` | Set if a queued action fails repeatedly |
| `insert(payload)` | `Promise<void>` | Insert a row, online or offline |
| `update(match, payload)` | `Promise<void>` | Update row(s) matching `match` |
| `remove(match)` | `Promise<void>` | Delete row(s) matching `match` |
| `refresh()` | `Promise<void>` | Manually re-fetch from Supabase |

## Current limitations (v0.1)

This is an early, honest v0.1 — it solves the core problem well but is intentionally scoped small:

- One table per hook call (no cross-table transactions).
- Conflict resolution is last-write-wins; no merge strategy yet.
- No built-in UI for sync status — you wire `pendingCount` / `syncError` into your own UI.

Contributions and issues are welcome — this is meant to grow with real use cases, not stay a toy.

## Development

```bash
npm install
npm run test    # runs the unit tests
npm run build   # builds dist/ with tsup
npm run lint    # type-checks with tsc
```

## License

MIT — see [LICENSE](./LICENSE).
