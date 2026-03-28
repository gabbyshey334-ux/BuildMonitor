-- Align Supabase with app + WhatsApp webhook (profiles as canonical user id).
-- Run in Supabase SQL Editor once. Safe to re-run where IF NOT EXISTS / IF EXISTS apply.
--
-- Covers: tasks (user_id → profiles, deleted_at, status values), vendors.total_transactions,
--         projects.start_date + status includes paused, optional FK rename.

-- ─── projects ───────────────────────────────────────────────────────────────
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS start_date date;

-- Replace status check to allow dashboard + webhook values
ALTER TABLE public.projects DROP CONSTRAINT IF EXISTS projects_status_check;
ALTER TABLE public.projects
  ADD CONSTRAINT projects_status_check CHECK (
    status = ANY (
      ARRAY[
        'active'::text,
        'completed'::text,
        'on_hold'::text,
        'paused'::text
      ]
    )
  );

-- ─── vendors ────────────────────────────────────────────────────────────────
ALTER TABLE public.vendors
  ADD COLUMN IF NOT EXISTS total_transactions integer NOT NULL DEFAULT 0;

-- ─── tasks ──────────────────────────────────────────────────────────────────
ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

-- Ensure user_id exists (legacy add_tasks_table.sql omitted it)
ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS user_id uuid;

-- Backfill task owners from project owner before NOT NULL + FK
UPDATE public.tasks t
SET user_id = p.user_id
FROM public.projects p
WHERE t.project_id = p.id
  AND (t.user_id IS NULL OR t.user_id IS DISTINCT FROM p.user_id);

-- Drop FK to public.users if present (name may vary)
ALTER TABLE public.tasks DROP CONSTRAINT IF EXISTS tasks_user_id_fkey;

-- Allow NOT NULL only when every row has user_id; set fallback impossible rows to first project owner
UPDATE public.tasks t
SET user_id = (SELECT user_id FROM public.projects p WHERE p.id = t.project_id LIMIT 1)
WHERE t.user_id IS NULL AND t.project_id IS NOT NULL;

-- If still null (orphan rows), delete or skip — here we delete orphan tasks without project
DELETE FROM public.tasks WHERE user_id IS NULL;

ALTER TABLE public.tasks
  ALTER COLUMN user_id SET NOT NULL;

ALTER TABLE public.tasks
  ADD CONSTRAINT tasks_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES public.profiles (id) ON DELETE CASCADE;

-- Widen task status for app + WhatsApp
ALTER TABLE public.tasks DROP CONSTRAINT IF EXISTS tasks_status_check;
ALTER TABLE public.tasks
  ADD CONSTRAINT tasks_status_check CHECK (
    status = ANY (
      ARRAY[
        'todo'::text,
        'in_progress'::text,
        'done'::text,
        'pending'::text,
        'completed'::text,
        'cancelled'::text
      ]
    )
  );

-- Optional columns used by Drizzle / API (add if missing)
ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS description text;

ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS priority text NOT NULL DEFAULT 'medium';

ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS due_date date;

ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'manual';

ALTER TABLE public.tasks DROP CONSTRAINT IF EXISTS tasks_priority_check;
ALTER TABLE public.tasks
  ADD CONSTRAINT tasks_priority_check CHECK (
    priority = ANY (ARRAY['low'::text, 'medium'::text, 'high'::text])
  );

ALTER TABLE public.tasks DROP CONSTRAINT IF EXISTS tasks_source_check;
ALTER TABLE public.tasks
  ADD CONSTRAINT tasks_source_check CHECK (
    source = ANY (ARRAY['whatsapp'::text, 'manual'::text, 'dashboard'::text])
  );

-- Optional soft-delete on projects (Drizzle/API expect this column)
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_tasks_user_id ON public.tasks USING btree (user_id);
CREATE INDEX IF NOT EXISTS idx_tasks_deleted_at ON public.tasks USING btree (deleted_at);

-- expense_categories: global reference rows (unique name, no user_id). Matches Drizzle in shared/schema.ts; no ALTER needed.
