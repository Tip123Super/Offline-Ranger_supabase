import { createClient } from '@supabase/supabase-js';
import { useOfflineRanger } from 'offline-ranger';

// Replace with your own project credentials.
const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

interface Todo {
  id: string;
  title: string;
  done: boolean;
}

export default function App() {
  const { data: todos, isOnline, pendingCount, insert, update, remove } =
    useOfflineRanger<Todo>(supabase, 'todos');

  return (
    <div style={{ maxWidth: 420, margin: '2rem auto', fontFamily: 'sans-serif' }}>
      <h1>Offline Ranger — demo</h1>
      <p>
        Status: <strong>{isOnline ? 'online' : 'offline'}</strong>
        {pendingCount > 0 && <> — {pendingCount} change(s) waiting to sync</>}
      </p>

      <button
        onClick={() =>
          insert({ id: crypto.randomUUID(), title: `Task ${todos.length + 1}`, done: false })
        }
      >
        Add task (works offline too)
      </button>

      <ul>
        {todos.map((todo) => (
          <li key={todo.id}>
            <label>
              <input
                type="checkbox"
                checked={todo.done}
                onChange={(e) => update({ id: todo.id }, { done: e.target.checked })}
              />
              {todo.title}
            </label>
            <button onClick={() => remove({ id: todo.id })}>Delete</button>
          </li>
        ))}
      </ul>

      <p style={{ color: '#666', fontSize: '0.9em' }}>
        Try turning off your network connection, adding a few tasks, then turning it back on —
        they'll sync automatically.
      </p>
    </div>
  );
}
