# Offline Ranger — basic usage example

A minimal to-do list app demonstrating `offline-ranger` in action.

## Setup

1. Create a `todos` table in your Supabase project with columns: `id` (uuid, primary key), `title` (text), `done` (boolean).
2. Copy `.env.example` to `.env` and fill in your Supabase project URL and anon key.
3. Install and run:

```bash
npm install
npm run dev
```

4. Open the app, add a few tasks, then turn off your network connection (or use your browser's dev tools to simulate offline) and keep adding/checking tasks. Turn the connection back on and watch them sync.
