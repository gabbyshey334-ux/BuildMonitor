-- ============================================================================
-- RLS: daily_logs, issues, vendors, sessions
-- Restrict access so users only see data for projects they own or manage.
-- Service role (e.g. WhatsApp webhook) bypasses RLS.
-- ============================================================================

-- Helper: projects the current user owns or manages
-- (We inline this in each policy for compatibility with Supabase policy editor.)

-- ----------------------------------------------------------------------------
-- daily_logs
-- ----------------------------------------------------------------------------
ALTER TABLE daily_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own or managed project daily_logs" ON daily_logs;
CREATE POLICY "Users can read own or managed project daily_logs"
ON daily_logs FOR SELECT
USING (
  project_id IN (
    SELECT id FROM projects
    WHERE user_id = auth.uid() OR manager_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Users can insert own or managed project daily_logs" ON daily_logs;
CREATE POLICY "Users can insert own or managed project daily_logs"
ON daily_logs FOR INSERT
WITH CHECK (
  project_id IN (
    SELECT id FROM projects
    WHERE user_id = auth.uid() OR manager_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Users can update own or managed project daily_logs" ON daily_logs;
CREATE POLICY "Users can update own or managed project daily_logs"
ON daily_logs FOR UPDATE
USING (
  project_id IN (
    SELECT id FROM projects
    WHERE user_id = auth.uid() OR manager_id = auth.uid()
  )
)
WITH CHECK (
  project_id IN (
    SELECT id FROM projects
    WHERE user_id = auth.uid() OR manager_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Users can delete own or managed project daily_logs" ON daily_logs;
CREATE POLICY "Users can delete own or managed project daily_logs"
ON daily_logs FOR DELETE
USING (
  project_id IN (
    SELECT id FROM projects
    WHERE user_id = auth.uid() OR manager_id = auth.uid()
  )
);

-- ----------------------------------------------------------------------------
-- issues
-- ----------------------------------------------------------------------------
ALTER TABLE issues ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own or managed project issues" ON issues;
CREATE POLICY "Users can read own or managed project issues"
ON issues FOR SELECT
USING (
  project_id IN (
    SELECT id FROM projects
    WHERE user_id = auth.uid() OR manager_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Users can insert own or managed project issues" ON issues;
CREATE POLICY "Users can insert own or managed project issues"
ON issues FOR INSERT
WITH CHECK (
  project_id IN (
    SELECT id FROM projects
    WHERE user_id = auth.uid() OR manager_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Users can update own or managed project issues" ON issues;
CREATE POLICY "Users can update own or managed project issues"
ON issues FOR UPDATE
USING (
  project_id IN (
    SELECT id FROM projects
    WHERE user_id = auth.uid() OR manager_id = auth.uid()
  )
)
WITH CHECK (
  project_id IN (
    SELECT id FROM projects
    WHERE user_id = auth.uid() OR manager_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Users can delete own or managed project issues" ON issues;
CREATE POLICY "Users can delete own or managed project issues"
ON issues FOR DELETE
USING (
  project_id IN (
    SELECT id FROM projects
    WHERE user_id = auth.uid() OR manager_id = auth.uid()
  )
);

-- ----------------------------------------------------------------------------
-- vendors
-- ----------------------------------------------------------------------------
ALTER TABLE vendors ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own or managed project vendors" ON vendors;
CREATE POLICY "Users can read own or managed project vendors"
ON vendors FOR SELECT
USING (
  project_id IN (
    SELECT id FROM projects
    WHERE user_id = auth.uid() OR manager_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Users can insert own or managed project vendors" ON vendors;
CREATE POLICY "Users can insert own or managed project vendors"
ON vendors FOR INSERT
WITH CHECK (
  project_id IN (
    SELECT id FROM projects
    WHERE user_id = auth.uid() OR manager_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Users can update own or managed project vendors" ON vendors;
CREATE POLICY "Users can update own or managed project vendors"
ON vendors FOR UPDATE
USING (
  project_id IN (
    SELECT id FROM projects
    WHERE user_id = auth.uid() OR manager_id = auth.uid()
  )
)
WITH CHECK (
  project_id IN (
    SELECT id FROM projects
    WHERE user_id = auth.uid() OR manager_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Users can delete own or managed project vendors" ON vendors;
CREATE POLICY "Users can delete own or managed project vendors"
ON vendors FOR DELETE
USING (
  project_id IN (
    SELECT id FROM projects
    WHERE user_id = auth.uid() OR manager_id = auth.uid()
  )
);

-- ----------------------------------------------------------------------------
-- sessions (express-session store: sid, sess jsonb, expire)
-- Restrict so authenticated users cannot read other users' sessions.
-- Server using service_role bypasses RLS.
-- ----------------------------------------------------------------------------
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;

-- Allow only when session payload contains current user (passport or userId)
DROP POLICY IF EXISTS "Users can manage own session" ON sessions;
CREATE POLICY "Users can manage own session"
ON sessions FOR ALL
USING (
  (sess->>'userId')::uuid = auth.uid()
  OR (sess->'passport'->>'user')::uuid = auth.uid()
)
WITH CHECK (
  (sess->>'userId')::uuid = auth.uid()
  OR (sess->'passport'->>'user')::uuid = auth.uid()
);

-- If session store does not embed user id in sess, the above may block server
-- writes. Server typically uses service_role which bypasses RLS. If your app
-- uses anon/key to write sessions, ensure sess includes userId or passport.user.
